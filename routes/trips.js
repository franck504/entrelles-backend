const express = require('express');
const router = express.Router();

const {
  createTrip,
  getAllTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  searchTrips,
  getMyTrips,
  getTripStats
} = require('../controllers/tripController');

const { protect } = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const { enrichTripData, requireKycVerification } = require('../middleware/tripValidation');

// ✅ ROUTES PUBLIQUES EN PREMIER
router.get('/search', searchTrips);
router.get('/', getAllTrips);

// ✅ ROUTES PROTÉGÉES
router.use(protect);

// ✅ ROUTES STATIQUES AVANT ROUTES DYNAMIQUES
router.get('/my-trips', requireActiveSubscription, getMyTrips);
router.get('/my-stats', requireActiveSubscription, getTripStats);

// ✅ CRÉATION AVEC KYC OBLIGATOIRE
router.post('/', requireActiveSubscription, requireKycVerification, enrichTripData, createTrip);

// ✅ ROUTES DYNAMIQUES À LA FIN
router.get('/:id', getTripById);
router.put('/:id', requireActiveSubscription, requireKycVerification, updateTrip);
router.delete('/:id', requireActiveSubscription, deleteTrip);

module.exports = router;