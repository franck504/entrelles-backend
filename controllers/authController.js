const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Génère un token JWT pour l'utilisateur
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * Envoie la réponse avec le cookie de session et les données utilisateur
 */
const sendTokenResponse = (user, statusCode, res, message = 'Succès') => {
  const token = user.generateAuthToken();

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      token,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        subscription: user.subscription,
        stats: user.stats,
        createdAt: user.createdAt
      }
    });
};

/**
 * @desc    Inscription d'un nouvel utilisateur
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { email, password, displayName, firstName, lastName, gender, phone, dateOfBirth } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Un utilisateur avec cet email existe déjà' });
    }

    const user = await User.create({
      email,
      password,
      profile: {
        displayName,
        firstName,
        lastName,
        gender: gender.toLowerCase(),
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined
      },
      metadata: {
        registrationSource: 'web',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    user.metadata.lastActive = new Date();
    await user.save();

    sendTokenResponse(user, 201, res, 'Inscription réussie');

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription' });
  }
};

/**
 * @desc    Connexion utilisateur
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    if (user.isLocked()) {
      return res.status(423).json({ success: false, message: 'Compte temporairement verrouillé' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Compte inactif' });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    if (user.security.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    user.security.lastLogin = new Date();
    user.metadata.lastActive = new Date();
    user.metadata.ipAddress = req.ip;
    user.metadata.userAgent = req.get('User-Agent');
    await user.save();

    sendTokenResponse(user, 200, res, 'Connexion réussie');

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion' });
  }
};

/**
 * @desc    Déconnexion utilisateur
 * @route   POST /api/auth/logout
 * @access  Privé
 */
const logout = async (req, res) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la déconnexion' });
  }
};

/**
 * @desc    Obtenir l'utilisateur actuel
 * @route   GET /api/auth/me
 * @access  Privé
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        subscription: user.subscription,
        stats: user.stats,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * @desc    Mot de passe oublié
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ success: false, message: 'Email non trouvé' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.security.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.security.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Envoi d'email à implémenter ici
    res.status(200).json({ success: true, message: 'Email de réinitialisation envoyé' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email' });
  }
};

/**
 * @desc    Réinitialiser le mot de passe
 * @route   PUT /api/auth/reset-password/:resettoken
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

    const user = await User.findOne({
      'security.passwordResetToken': resetPasswordToken,
      'security.passwordResetExpires': { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'Token invalide ou expiré' });

    user.password = req.body.password;
    user.security.passwordResetToken = undefined;
    user.security.passwordResetExpires = undefined;
    user.security.loginAttempts = 0;
    user.security.lockUntil = undefined;

    await user.save();

    sendTokenResponse(user, 200, res, 'Réinitialisation du mot de passe réussie');

  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation' });
  }
};

/**
 * @desc    Mettre à jour le profil utilisateur
 * @route   PUT /api/auth/update-profile
 * @access  Privé
 */
const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const allowedFields = [
      'displayName', 'firstName', 'lastName', 'phone', 'bio',
      'profileImageUrl', 'vehicleImageUrl', 'address'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'address' && typeof req.body[field] === 'object') {
          Object.keys(req.body[field]).forEach(addressField => {
            fieldsToUpdate[`profile.address.${addressField}`] = req.body[field][addressField];
          });
        } else {
          fieldsToUpdate[`profile.${field}`] = req.body[field];
        }
      }
    });

    if (req.body.preferences) {
      const allowedPreferences = ['allowSmoking', 'allowPets', 'musicPreference', 'chatLevel'];
      allowedPreferences.forEach(pref => {
        if (req.body.preferences[pref] !== undefined) {
          fieldsToUpdate[`preferences.${pref}`] = req.body.preferences[pref];
        }
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, { new: true, runValidators: true });

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
};

/**
 * @desc    Changer le mot de passe
 * @route   PUT /api/auth/change-password
 * @access  Privé
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Ancien et nouveau mot de passe requis' });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Mot de passe changé avec succès' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors du changement de mot de passe' });
  }
};

/**
 * @desc    Supprimer le compte utilisateur (désactivation)
 * @route   DELETE /api/auth/delete-account
 * @access  Privé
 */
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    if (req.body.password) {
      const isPasswordValid = await user.comparePassword(req.body.password);
      if (!isPasswordValid) return res.status(401).json({ success: false, message: 'Mot de passe requis pour la suppression' });
    }

    user.status = 'deleted';
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
    res.status(200).json({ success: true, message: 'Compte supprimé avec succès' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du compte' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  deleteAccount
};