const express = require('express');
const router = express.Router();

// Importation des controllers et middlewares
const {
  createTrip,
  searchTrips,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  cancelTrip,
  getPopularTrips
} = require('../controllers/tripController');

const { protect } = require('../middleware/authMiddleware');

// Validation middleware pour les trajets
const { body, query, validationResult } = require('express-validator');

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

// Validation pour la création de trajet
const validateCreateTrip = [
  body('departure.city')
    .notEmpty()
    .trim()
    .withMessage('Departure city is required'),
    
  body('departure.address')
    .notEmpty()
    .trim()
    .withMessage('Departure address is required'),
    
  body('departure.coordinates.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid departure latitude is required'),
    
  body('departure.coordinates.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid departure longitude is required'),
    
  body('arrival.city')
    .notEmpty()
    .trim()
    .withMessage('Arrival city is required'),
    
  body('arrival.address')
    .notEmpty()
    .trim()
    .withMessage('Arrival address is required'),
    
  body('arrival.coordinates.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid arrival latitude is required'),
    
  body('arrival.coordinates.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid arrival longitude is required'),
    
  body('departureDateTime')
    .isISO8601()
    .withMessage('Valid departure date and time is required')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Departure date must be in the future');
      }
      return true;
    }),
    
  body('estimatedDuration')
    .isInt({ min: 1, max: 1440 })
    .withMessage('Estimated duration must be between 1 and 1440 minutes'),
    
  body('availableSeats')
    .isInt({ min: 1, max: 7 })
    .withMessage('Available seats must be between 1 and 7'),
    
  body('pricePerSeat')
    .isFloat({ min: 0, max: 200 })
    .withMessage('Price per seat must be between 0 and 200 euros'),
    
  body('distance')
    .isFloat({ min: 1, max: 2000 })
    .withMessage('Distance must be between 1 and 2000 km'),
    
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
    
  handleValidationErrors
];

// Validation pour la recherche de trajets
const validateSearchTrips = [
  query('departureCity')
    .notEmpty()
    .trim()
    .withMessage('Departure city is required'),
    
  query('arrivalCity')
    .notEmpty()
    .trim()
    .withMessage('Arrival city is required'),
    
  query('departureDate')
    .isISO8601()
    .withMessage('Valid departure date is required'),
    
  query('passengers')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Passengers must be between 1 and 7'),
    
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
    
  handleValidationErrors
];

// Validation pour la mise à jour de trajet
const validateUpdateTrip = [
  body('departure.city')
    .optional()
    .notEmpty()
    .trim()
    .withMessage('Departure city cannot be empty'),
    
  body('arrival.city')
    .optional()
    .notEmpty()
    .trim()
    .withMessage('Arrival city cannot be empty'),
    
  body('departureDateTime')
    .optional()
    .isISO8601()
    .withMessage('Valid departure date and time is required')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Departure date must be in the future');
      }
      return true;
    }),
    
  body('availableSeats')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Available seats must be between 1 and 7'),
    
  body('pricePerSeat')
    .optional()
    .isFloat({ min: 0, max: 200 })
    .withMessage('Price per seat must be between 0 and 200 euros'),
    
  handleValidationErrors
];

// Routes publiques
router.get('/search', validateSearchTrips, searchTrips);
router.get('/popular', getPopularTrips);
router.get('/:id', getTripById);

// Routes protégées (nécessitent une authentification)
router.use(protect);

router.post('/', validateCreateTrip, createTrip);
router.get('/', getMyTrips); // Mes trajets
router.put('/:id', validateUpdateTrip, updateTrip);
router.delete('/:id', deleteTrip);
router.put('/:id/cancel', cancelTrip);

module.exports = router;