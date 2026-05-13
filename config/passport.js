const passport = require('passport');
const User = require('../models/User');

/**
 * Sérialisation de l'utilisateur pour la session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Désérialisation de l'utilisateur pour la session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;