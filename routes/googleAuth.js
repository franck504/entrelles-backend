const express = require('express');
const passport = require('../config/passport');
const User = require('../models/User');
const router = express.Router();

/**
 * @desc    Initier l'authentification Google
 * @route   GET /api/auth/google
 * @access  Public
 */
router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @desc    Callback après authentification Google
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      if (user.profile.gender !== 'femme') {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/confirm-gender?userId=${user._id}`);
      }

      const token = user.generateAuthToken();
      const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };

      res.cookie('token', token, cookieOptions);

      user.security.lastLogin = new Date();
      user.metadata.lastActive = new Date();
      await user.save();

      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);

    } catch (error) {
      console.error('Erreur callback Google:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=authentication_failed`);
    }
  }
);

/**
 * @desc    Confirmer le genre de l'utilisatrice après connexion Google
 * @route   POST /api/auth/google/confirm-gender
 * @access  Public
 */
router.post('/confirm-gender', async (req, res) => {
  try {
    const { userId, gender } = req.body;

    if (gender !== 'femme') {
      return res.status(403).json({
        success: false,
        message: 'Seules les femmes sont autorisées sur cette plateforme'
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisatrice non trouvée' });

    user.profile.gender = 'femme';
    await user.save();

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
      message: 'Genre confirmé avec succès',
      token,
      user
    });

  } catch (error) {
    console.error('Erreur confirmation genre:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la confirmation du genre' });
  }
});

module.exports = router;