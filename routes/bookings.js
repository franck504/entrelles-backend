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
  getMyBookings,
  deleteAllBookings
} = require('../controllers/bookingController');

const { protect } = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// Routes publiques (Maintenance/Test)
router.delete('/delete-all', deleteAllBookings);

// Toutes les routes suivantes nécessitent une authentification
router.use(protect);

// Routes principales
router.post('/', requireActiveSubscription, createBooking);
router.get('/', getAllBookings);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBookingById);

// Actions sur les réservations
router.put('/:id/confirm', confirmBooking);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/complete', completeBooking);
router.post('/:id/review', addReview);

module.exports = router;