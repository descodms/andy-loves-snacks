import { $ } from '../modules/bling';
//ES6 import
import axios from 'axios';
import dompurify from 'dompurify';

function searchResultsHTML(stores) {
  let id = 1;
  return stores
    .map(store => {
      return `
      <a href="/store/${store.slug}" id="store-${id++}"  class="search__result">
        <strong>${store.name}</strong>
      </a>
    `;
    })
    .join('');
}

function typeAhead(search) {
  let active = 0;
  let dataLength = 0;
  if (!search) return;

  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');
  searchInput.on('input', function() {
    // if there is no value, quit it!
    if (!this.value) {
      searchResults.style.display = 'none';
      return; // stop!
    }

    // show the search results!
    searchResults.style.display = 'block';

    axios
      .get(`/api/search?q=${this.value}`)
      .then(res => {
        if (res.data.length) {
          dataLength = res.data.length;
          //dompurify para sanitizar innerHTML
          searchResults.innerHTML = dompurify.sanitize(
            searchResultsHTML(res.data),
          );
        } else {
          searchResults.innerHTML = dompurify.sanitize(
            `<div class='search__result'>No Results for ${
              this.value
            } found</div>`,
          );
        }
      })
      .catch(err => {});
  });

  //handle keyboard inputs
  searchInput.on('keyup', e => {
    // if they aren't pressing up, down or enter, who cares!
    if (![38, 40, 13].includes(e.keyCode)) {
      return; //nah
    }

    const elementDesactive = $(`#store-${active}`);
    if (elementDesactive) {
      elementDesactive.className = 'search__result';
    }
    if (e.keyCode === 40) {
      active++;
    } else if (e.keyCode === 38) {
      active--;
    }
    if (active < 1) {
      active = dataLength;
    }
    if (active > dataLength) {
      active = 1;
    }
    const elementActive = $(`#store-${active}`);
    if (elementActive) {
      elementActive.className += ' ' + 'search__result--active';
      if (e.keyCode === 13) {
        window.location.href = elementActive.href;
      }
    }
  });
}

export default typeAhead;
