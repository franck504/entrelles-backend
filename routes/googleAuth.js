const express = require('express');
const passport = require('../config/passport');
const User = require('../models/User');
const router = express.Router();

// @desc    Initier l'authentification Google
// @route   GET /api/auth/google
// @access  Public
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// @desc    Callback Google OAuth
// @route   GET /api/auth/google/callback
// @access  Public
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Vérifier si l'utilisateur a confirmé son genre
      if (user.profile.gender !== 'femme') {
        // Rediriger vers une page de confirmation du genre
        return res.redirect(`${process.env.FRONTEND_URL}/auth/confirm-gender?userId=${user._id}`);
      }

      // Générer le token JWT
      const token = user.generateAuthToken();
      
      // Définir le cookie
      const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };

      res.cookie('token', token, cookieOptions);

      // Mettre à jour la dernière connexion
      user.security.lastLogin = new Date();
      user.metadata.lastActive = new Date();
      await user.save();

      // Rediriger vers le frontend avec succès
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);

    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=authentication_failed`);
    }
  }
);

// @desc    Confirmer le genre après connexion Google
// @route   POST /api/auth/google/confirm-gender
// @access  Public (mais avec userId)
router.post('/confirm-gender', async (req, res) => {
  try {
    const { userId, gender } = req.body;

    if (gender !== 'femme') {
      return res.status(403).json({
        success: false,
        message: 'Only women are allowed on this platform'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Confirmer le genre
    user.profile.gender = 'femme';
    await user.save();

    // Générer le token et connecter l'utilisateur
    const token = user.generateAuthToken();
    
    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Gender confirmed successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        subscription: user.subscription
      }
    });

  } catch (error) {
    console.error('Confirm gender error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during gender confirmation'
    });
  }
});

module.exports = router;