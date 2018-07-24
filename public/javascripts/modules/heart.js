import axios from 'axios';
import { $, $$ } from './bling';

function ajaxHeart(e) {
  e.preventDefault();
  axios
    .post(this.action)
    .then(res => {
      this.heart.classList.toggle('heart__button--hearted');
      const isHearted = ($('.heart-count').textContent =
        res.data.hearts.length);
      console.log(res.data);
      if (isHearted || isHearted === 0) {
        this.heart.classList.add('heart__button--float');
        setTimeout(
          () => this.heart.classList.remove('heart__button--float'),
          1500,
        );
      }
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath === '/hearts') {
        setTimeout(
          () => this.parentNode.parentNode.parentNode.parentNode.remove(),
          1500,
        );
      }
    })
    .catch(console.error);
}

export default ajaxHeart;
