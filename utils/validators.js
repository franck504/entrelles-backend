const { body, validationResult } = require('express-validator');

/**
 * Gère les erreurs retournées par express-validator
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

/**
 * Validation pour l'inscription d'une nouvelle utilisatrice
 */
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir une minuscule, une majuscule et un chiffre'),

  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom d\'affichage doit contenir entre 2 et 50 caractères'),

  body('gender')
    .equals('femme')
    .withMessage('Seules les femmes peuvent s\'inscrire sur cette plateforme'),

  handleValidationErrors
];

/**
 * Validation pour la connexion
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),

  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),

  handleValidationErrors
];

/**
 * Validation pour la demande de réinitialisation de mot de passe
 */
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),

  handleValidationErrors
];

/**
 * Validation pour la réinitialisation effective du mot de passe
 */
const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Le jeton de réinitialisation est requis'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('La confirmation du mot de passe ne correspond pas');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation pour la mise à jour du profil
 */
const validateUpdateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom d\'affichage doit contenir entre 2 et 50 caractères'),

  body('phone')
    .optional()
    .matches(/^[\+]?[0-9]{10,15}$/)
    .withMessage('Veuillez fournir un numéro de téléphone valide'),

  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La biographie ne peut pas dépasser 500 caractères'),

  handleValidationErrors
];

/**
 * Validation pour la création d'un trajet
 */
const validateCreateTrip = [
  body('departure.city')
    .notEmpty()
    .withMessage('La ville de départ est requise'),

  body('arrival.city')
    .notEmpty()
    .withMessage('La ville d\'arrivée est requise'),

  body('departureDateTime')
    .notEmpty()
    .isISO8601()
    .withMessage('Une date et heure de départ valides sont requises'),

  body('availableSeats')
    .isInt({ min: 1, max: 8 })
    .withMessage('Le nombre de places doit être compris entre 1 et 8'),

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