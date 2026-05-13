const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getMyBookings
} = require('../controllers/bookingController');

const { protect } = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// Authentification requise pour toutes les routes de réservation
router.use(protect);

// Routes de gestion des réservations
router.post('/', requireActiveSubscription, createBooking);
router.get('/', getAllBookings);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBookingById);

// Actions de changement de statut
router.put('/:id/confirm', confirmBooking);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/complete', completeBooking);

// Évaluation après trajet
router.post('/:id/review', addReview);

module.exports = router;