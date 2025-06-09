const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Configuration Google OAuth Strategy - TEMPORAIREMENT DÉSACTIVÉE
/*
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Vérifier si l'utilisateur existe déjà avec cet ID Google
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      // Utilisateur existant trouvé
      return done(null, user);
    }

    // Vérifier si un utilisateur existe avec le même email
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Lier le compte Google à l'utilisateur existant
      user.googleId = profile.id;
      user.profile.avatar = user.profile.avatar || profile.photos[0]?.value;
      await user.save();
      return done(null, user);
    }

    // Créer un nouvel utilisateur
    // Note: On ne peut pas déterminer automatiquement le genre depuis Google
    // L'utilisateur devra le spécifier lors de la première connexion
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      profile: {
        displayName: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        avatar: profile.photos[0]?.value,
        gender: 'femme' // Valeur par défaut, à confirmer par l'utilisateur
      },
      verification: {
        isEmailVerified: true // Email vérifié par Google
      },
      metadata: {
        registrationSource: 'google'
      }
    });

    done(null, user);
  } catch (error) {
    console.error('Google OAuth error:', error);
    done(error, null);
  }
}));
*/

// Sérialisation pour les sessions
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;