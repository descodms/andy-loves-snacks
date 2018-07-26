const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      //jelou git
      next({ message: "That filetype isn't allowed!" }, false);
    }
  },
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug })
    // .populate({ path: 'author', select: '_id' })
    .populate('author reviews');
  if (!store) return next();
  res.render('store', { title: store.name, store });
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to our filesystem, keep going!
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await new Store(req.body).save();
  req.flash(
    'success',
    `Successfully Created ${store.name}. Care to leave a review?`,
  );
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  //? Pagination
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;
  // 1. Query the database for a list of all stores
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);

  if (!stores.length && skip) {
    req.flash(
      'info',
      `Hey! you asked for page ${page}. But that doesn't exist. So I put you on page ${pages}`,
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, count, page, pages });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it!');
  }
};

exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out the edit form so the user can update their store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // set the location data to be a point
  req.body.location.type = 'Point';
  // find and update the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store instead of the old one
    runValidators: true,
  }).exec();

  req.flash(
    'success',
    `Successfully updated <strong>${store.name}</strong>. <a href="/store/${
      store.slug
    }">View Store →</a>`,
  );

  res.redirect(`/stores/${store._id}/edit`);
  // Redirect them the store and tell them it worked
};

//* 2 queries en el mismo metodo
//* en vez de escribir las queries por separado y poner await a cada una, hace las queries SIN el await, lo cual las convierte en una Promise ya que son async y luego llama a Promise.all con await y pasa las 2 queries como parametros.
exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  //* ES6 destructuring
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tags', { title: 'Tags', tags, tag, stores });
};

exports.getHearts = async (req, res) => {
  //? version con populate(): metodo de mongoose que entiende $lookp de mongoDB,
  //? que sirve para queriar "joints"
  // let storeHearts = await User.find({ _id: req.user.id }).populate('hearts');
  // storeHearts = storeHearts[0].hearts;

  //? version con find regular con la query en arrays
  const stores = await Store.find({
    _id: { $in: req.user.hearts },
  });
  // if (stores === undefined || !stores) {
  //   req.flash('error', 'No Stores Hearted Yet!');
  //   res.render('stores', { title: 'Stores' });
  //   return;
  // }
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

/* API */

//este es el primer metodo de la API disponible para el lado del cliente(browser)
exports.searchStores = async (req, res) => {
  // aca hace la busqueda en base a la query search que viene del cliente
  const stores = await Store.find(
    {
      //text hace una busqueda de texto en el contenido de los fields indexados como text
      $text: {
        $search: req.query.q,
      },
    },
    {
      //score en base a la metadata, por ej si buscamos coffee, cuantos mas matches tenga con coffe, mas alto puntaje tendra y por ende le damos mas importancia en el resultado de la busqueda
      score: { $meta: 'textScore' },
    },
  )
    .sort({
      score: { $meta: 'textScore' },
    })
    // limit to only 5 results
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  //MongoDB built in geospatial location: $near
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: 10000, // in meters === 10km
      },
    },
  };

  const stores = await Store.find(q)
    .select('slug name photo description location')
    .limit(10);
  res.json(stores);
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  //con este operador tipo switch si el storeHeart ya existe, lo saca, sino lo guarda
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      [operator]: { hearts: req.params.id },
    },
    { new: true },
  );
  res.json(user);
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { title: '⭐️ Top Stores!', stores });
};
