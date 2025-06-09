const express = require('express');
const router = express.Router();

// Importation des controllers et middlewares
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  deleteAccount
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile
} = require('../utils/validators');

// Routes publiques
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.put('/reset-password/:resettoken', validateResetPassword, resetPassword);

// Routes protégées (nécessitent une authentification)
router.use(protect); // Toutes les routes suivantes nécessitent une authentification

router.get('/me', getMe);
router.post('/logout', logout);
router.put('/update-profile', validateUpdateProfile, updateProfile);
router.put('/change-password', changePassword);
router.delete('/delete-account', deleteAccount);

module.exports = router;