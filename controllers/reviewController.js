const mongoose = require('mongoose');
const Review = mongoose.model('Review');

exports.addReview = async (req, res) => {
  req.body.author = req.user._id;
  req.body.store = req.params.id;
  const newReview = new Review(req.body);
  await newReview.save();
  req.flash('success', 'Review Saved!');
  res.redirect('back');
  // console.log
  // const review = await new Review(save).save();
  // const storeUpdate = await Store.findByIdAndUpdate(
  //   req.params.id,
  //   {
  //     ['$addToSet']: { reviews: review._id },
  //   },
  //   { new: true },
  // );
  // console.log(review);
  // console.log(storeUpdate);
  // req.flash('success', 'Review saved!');
  // res.redirect('back');

  // res.render('review', { review });
};
