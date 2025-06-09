const express = require('express');
const router = express.Router();

// Importation des controllers et middlewares
const {
  createBooking,
  getMyBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getUpcomingBookings,
  getPendingRequests,
  getBookingStats
} = require('../controllers/bookingController');

const { protect } = require('../middleware/authMiddleware');
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

// Validation pour créer une réservation
const validateCreateBooking = [
  body('tripId')
    .isMongoId()
    .withMessage('Valid trip ID is required'),
    
  body('numberOfSeats')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Number of seats must be between 1 and 7'),
    
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
    
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Emergency contact name must be between 2 and 50 characters'),
    
  body('emergencyContact.phone')
    .optional()
    .matches(/^[\+]?[0-9]{10,15}$/)
    .withMessage('Valid emergency contact phone number is required'),
    
  handleValidationErrors
];

// Validation pour ajouter une évaluation
const validateAddReview = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
    
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
    
  handleValidationErrors
];

// Validation pour annuler une réservation
const validateCancelBooking = [
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters'),
    
  handleValidationErrors
];

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes principales
router.post('/', validateCreateBooking, createBooking);
router.get('/', getMyBookings);
router.get('/upcoming', getUpcomingBookings);
router.get('/pending-requests', getPendingRequests);
router.get('/stats', getBookingStats);
router.get('/:id', getBookingById);

// Actions sur les réservations
router.put('/:id/confirm', confirmBooking);
router.put('/:id/cancel', validateCancelBooking, cancelBooking);
router.put('/:id/complete', completeBooking);
router.put('/:id/review', validateAddReview, addReview);

module.exports = router;