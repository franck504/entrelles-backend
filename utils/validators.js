const { body, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Validation pour l'inscription
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
    
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('First name cannot exceed 30 characters'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Last name cannot exceed 30 characters'),
    
  body('gender')
    .equals('femme')
    .withMessage('Only women are allowed to register on this platform'),
    
  body('phone')
    .optional()
    .matches(/^[\+]?[0-9]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
    
  handleValidationErrors
];

// Validation pour la connexion
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

// Validation pour la réinitialisation du mot de passe
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  handleValidationErrors
];

// Validation pour le nouveau mot de passe
const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Validation pour la mise à jour du profil
const validateUpdateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
    
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('First name cannot exceed 30 characters'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Last name cannot exceed 30 characters'),
    
  body('phone')
    .optional()
    .matches(/^[\+]?[0-9]{10,15}$/)
    .withMessage('Please provide a valid phone number (10-15 digits, optional + prefix)'),
    
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
    
  handleValidationErrors
];

// ✅ VALIDATION ALLÉGÉE POUR TRAJETS (compatible avec enrichissement)
const validateCreateTrip = [
  // ✅ OBLIGATOIRES SEULEMENT
  body('departure.city')
    .notEmpty()
    .withMessage('Departure city is required'),
  
  body('arrival.city')
    .notEmpty()
    .withMessage('Arrival city is required'),
  
  body('departureDateTime')
    .notEmpty()
    .isISO8601()
    .withMessage('Valid departure date and time is required'),
  
  body('availableSeats')
    .isInt({ min: 1, max: 8 })
    .withMessage('Available seats must be between 1 and 8'),
  
  // ✅ OPTIONNELS (seront enrichis automatiquement)
  body('departure.address')
    .optional()
    .trim(),
  
  body('arrival.address')
    .optional()
    .trim(),
  
  body('pricePerSeat')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per seat must be a positive number'),
  
  body('distance')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Distance must be a positive number'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateCreateTrip,
  handleValidationErrors
};