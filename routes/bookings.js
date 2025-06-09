const express = require('express');
const router = express.Router();

const {
  createBooking,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getMyBookings,
  getUpcomingBookings,
  getPendingRequests,
  getBookingStats
} = require('../controllers/bookingController');

const { protect } = require('../middleware/authMiddleware');

// Routes publiques (si nécessaire)
// Aucune pour l'instant

// Routes protégées
router.use(protect);

// Routes principales
router.post('/', createBooking);
router.get('/pending-requests', getPendingRequests);
router.get('/upcoming', getUpcomingBookings);
router.get('/stats', getBookingStats);
router.get('/', getMyBookings);

// Routes avec ID - ✅ IMPORTANT: Utiliser :id pas :bookingId
router.get('/:id', getBookingById);
router.put('/:id/confirm', confirmBooking);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/complete', completeBooking);
router.put('/:id/review', addReview);

module.exports = router;