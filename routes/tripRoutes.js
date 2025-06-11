const express = require('express');
const router = express.Router();
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
const { enrichTripData } = require('../middleware/tripValidation'); // ✅ NOUVEAU

// Routes publiques
router.get('/search', searchTrips);
router.get('/popular', getPopularTrips);
router.get('/:id', getTripById);

// Routes protégées
router.use(protect); // Toutes les routes suivantes nécessitent une authentification

router.post('/', enrichTripData, createTrip); // ✅ MIDDLEWARE AJOUTÉ
router.get('/', getMyTrips);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);
router.patch('/:id/cancel', cancelTrip);

module.exports = router;