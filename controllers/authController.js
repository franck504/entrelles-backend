const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Utilitaire pour générer un token JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Utilitaire pour envoyer une réponse avec token
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
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
        profile: {
          displayName: user.profile.displayName,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          avatar: user.profile.avatar,
          profileImageUrl: user.profile.profileImageUrl,
          vehicleImageUrl: user.profile.vehicleImageUrl,
          gender: user.profile.gender,
          address: user.profile.address
        },
        verification: {
          isEmailVerified: user.verification.isEmailVerified,
          isPhoneVerified: user.verification.isPhoneVerified,
          isIdentityVerified: user.verification.isIdentityVerified
        },
        subscription: user.subscription,
        stats: user.stats,
        createdAt: user.createdAt
      }
    });
};

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      displayName,
      firstName,
      lastName,
      gender,
      phone,
      dateOfBirth
    } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Créer le nouvel utilisateur
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

    // Mettre à jour la dernière activité
    user.metadata.lastActive = new Date();
    await user.save();

    sendTokenResponse(user, 201, res, 'Registration successful');

  } catch (error) {
    console.error('Registration error:', error);

    // Gestion des erreurs de validation MongoDB
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    // Gestion des erreurs de duplication
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Connexion utilisateur
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to too many failed login attempts'
      });
    }

    // Vérifier si le compte est actif
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Incrémenter les tentatives de connexion
      await user.incLoginAttempts();

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Réinitialiser les tentatives de connexion en cas de succès
    if (user.security.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Mettre à jour la dernière connexion
    user.security.lastLogin = new Date();
    user.metadata.lastActive = new Date();
    user.metadata.ipAddress = req.ip;
    user.metadata.userAgent = req.get('User-Agent');
    await user.save();

    sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Déconnexion utilisateur
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Obtenir l'utilisateur actuel
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mot de passe oublié
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Générer le token de réinitialisation
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hasher le token et le sauvegarder
    user.security.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Expiration dans 10 minutes
    user.security.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // TODO: Envoyer l'email avec le token
    // Pour l'instant, on retourne le token (à supprimer en production)

    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Email could not be sent'
    });
  }
};

// @desc    Réinitialiser le mot de passe
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
  try {
    // Hasher le token de l'URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      'security.passwordResetToken': resetPasswordToken,
      'security.passwordResetExpires': { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Définir le nouveau mot de passe
    user.password = req.body.password;
    user.security.passwordResetToken = undefined;
    user.security.passwordResetExpires = undefined;
    user.security.loginAttempts = 0;
    user.security.lockUntil = undefined;

    await user.save();

    sendTokenResponse(user, 200, res, 'Password reset successful');

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

// @desc    Mettre à jour le profil utilisateur
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const allowedFields = [
      'displayName', 'firstName', 'lastName', 'phone', 'bio',
      'profileImageUrl', 'vehicleImageUrl', 'address'
    ];

    // Filtrer les champs autorisés
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'address' && typeof req.body[field] === 'object') {
          // Gestion spéciale pour l'adresse (objet)
          Object.keys(req.body[field]).forEach(addressField => {
            fieldsToUpdate[`profile.address.${addressField}`] = req.body[field][addressField];
          });
        } else if (field === 'profileImageUrl' || field === 'vehicleImageUrl') {
          // Ces champs sont déjà dans le schéma profile
          fieldsToUpdate[`profile.${field}`] = req.body[field];
        } else {
          // Pour displayName, firstName, lastName, phone, bio
          fieldsToUpdate[`profile.${field}`] = req.body[field];
        }
      }
    });

    // Mettre à jour les préférences si fournies
    if (req.body.preferences) {
      const allowedPreferences = ['allowSmoking', 'allowPets', 'musicPreference', 'chatLevel'];
      allowedPreferences.forEach(pref => {
        if (req.body.preferences[pref] !== undefined) {
          fieldsToUpdate[`preferences.${pref}`] = req.body.preferences[pref];
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
};

// @desc    Changer le mot de passe
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation basique
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
};

// @desc    Supprimer le compte utilisateur
// @route   DELETE /api/auth/delete-account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Vérifier le mot de passe pour la suppression
    if (user.password) {
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }
    }

    // Marquer le compte comme supprimé au lieu de le supprimer définitivement
    user.status = 'deleted';
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    // Nettoyer le cookie
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during account deletion'
    });
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