const express = require('express');
const router = express.Router();
const {
  createTrip,
  getAllTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  cancelTrip,
  searchTrips,
  getMyTrips,
  getTripStats,
  markTripAsViewed
} = require('../controllers/tripController');

const { protect } = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const { enrichTripData, requireKycVerification } = require('../middleware/tripValidation');

// Routes publiques
router.get('/search', searchTrips);
router.get('/', getAllTrips);
router.get('/:id', getTripById);

// Routes protégées
router.use(protect);

// Gestion des trajets personnels et statistiques
router.get('/my-trips', requireActiveSubscription, getMyTrips);
router.get('/my-stats', requireActiveSubscription, getTripStats);

// Création d'un trajet (nécessite un abonnement actif et une vérification d'identité)
router.post('/', requireActiveSubscription, requireKycVerification, enrichTripData, createTrip);

// Actions spécifiques sur un trajet
router.post('/:id/view', markTripAsViewed);
router.patch('/:id/cancel', requireActiveSubscription, cancelTrip);
router.put('/:id', requireActiveSubscription, requireKycVerification, updateTrip);
router.delete('/:id', requireActiveSubscription, deleteTrip);

module.exports = router;