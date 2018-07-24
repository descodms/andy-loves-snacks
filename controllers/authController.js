const passport = require("passport");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const crypto = require("crypto");
const promisify = require("es6-promisify");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Failed Login!",
  successRedirect: "/",
  successFlash: "You are now logged in!"
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "You are now logged out!");
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  //first check if the user is authenticated
  if (req.isAuthenticated()) {
    next(); // carry on! they are logged in!
    return;
  }
  req.flash("error", "Oops you must be logged in to do that");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  // 1. see if a user with that email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "Invalid Registered Email");
    res.redirect("back");
    return;
  }
  // 2. set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  await user.save();
  // 3. send them an email with the token
  //req.headers.host url donde se esta operando (localhost o dominio.com)
  const resetURL = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;

  await mail.send({
    user,
    subject: "Password Reset",
    from: "Andy < noreply@gmail.com>",
    resetURL,
    filename: "password-reset"
  });

  req.flash("success", `You have been emailed a password reset link`);
  // 4. redirect to login page
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    // aca con el $gt mete el chequeo de que el given token sea mas chico que el guardado
    // $gt es Greater than
    resetPasswordExpires: { $gt: Date.now() }
  });
  // check if user exists with the given token
  if (!user) {
    req.flash("error", "Invalid Token or expired");
    res.redirect("/login");
  }
  res.render("resetPassword", { title: "Reset Password" });
};

exports.confirmedPasswords = (req, res, next) => {
  // para acceder a una propiedad con guion en el medio password-confirm, hay que poner corchetes y ''
  if (req.body.password === req.body["password-confirm"]) {
    next(); // ok, keepit going!
    return;
  }
  req.flash("error", "Password do not match");
  res.redirect("back");
};

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Invalid Token or expired");
    res.redirect("/login");
  }

  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  // MongoDB para borrar fields se ponen undefined
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  // passport middleware
  await req.login(updatedUser);
  req.flash("success", "Password succesfully updated, you are now logged in");
  res.redirect("/");
};
