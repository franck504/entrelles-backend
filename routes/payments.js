const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  createAndActivateSubscription,
  getSubscriptionStatus,
  createTripPayment,
  finalizeTripPayment,
  getDriverFinancialStatus  // ✅ AJOUTEZ CETTE LIGNE
} = require('../controllers/paymentController');

// ✅ ROUTES ESSENTIELLES
router.use(protect);

// Abonnements
router.post('/subscribe', createAndActivateSubscription);
router.get('/subscription-status', getSubscriptionStatus);

// Paiements trajets
router.post('/create-trip-payment', createTripPayment);
router.post('/finalize-trip-payment', finalizeTripPayment);

// ✅ AJOUTEZ CETTE ROUTE AVANT module.exports
router.get('/driver/financial-status', getDriverFinancialStatus);

module.exports = router;