const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: 'Please enter a store name!',
    },
    slug: String,
    description: {
      type: String,
      trim: true,
    },
    tags: [String],
    created: {
      type: Date,
      default: Date.now,
    },
    // MongoDB Geolocation built in
    location: {
      type: {
        type: String,
        default: 'Point',
      },
      coordinates: [
        {
          type: Number,
          required: 'You must supply coordinates',
        },
      ],
      address: {
        type: String,
        required: 'You must supply an address',
      },
    },
    photo: String,
    //relationship between collections ref: User
    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: 'You must supply an author',
    },
  },

  //! por defecto no aparece en el objeto de Store al hacer un find por ej,
  //!hay que llamarlo explicitamente, por ej: store.reviews
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

//* Define our indexes
//* compound index (2 fields index as 1)
storeSchema.index({
  name: 'text',
  description: 'text',
});

//geospatial type in MongoDB
storeSchema.index({ location: '2dsphere' });

// aca necesita que la funcion sea normal (no arrow) porque necesita el scope this
storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  // find other stores that have a slug of wes, wes-1, wes-2
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  //* aca lo que hace al poner this.constructor es llamar al model Store pero mas adelante (async) porque aca todavía no existe, no esta creado el new Store...todavía, entonces this.constructor en el futuro va a ser igual a Store.
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

storeSchema.statics.getTopStores = function() {
  // aggregate devuelve una Promise, por eso le hace await en el controller al llamar a getTopStores
  // primero array como parametro

  return this.aggregate([
    // lookup stores and populate their reviews
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews',
      },
    },
    // filter for only items that have 2 or more reviews
    { $match: { 'reviews.1': { $exists: true } } },
    // add the average reviews field
    {
      // addFields se agrego en mongoDB 3.4
      $addFields: {
        // $project: {
        //   photo: '$$ROOT.photo',
        //   name: '$$ROOT.name',
        //   slug: '$$ROOT.slug',
        //   reviews: '$$ROOT.reviews',
        averageRating: { $avg: '$reviews.rating' },
      },
    },
    // sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 } },
    // limit to ar most 10
    { $limit: 10 },
  ]);
};

//virtual (es de mongoose) populate con referencia al otro Model
// find reviews where the stores _id property === reviews store property
//sql join like
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store', // which field on the review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
