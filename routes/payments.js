const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// ✅ ROUTES PRINCIPALES SEULEMENT
router.post('/subscribe', protect, paymentController.createAndActivateSubscription);
router.get('/subscription-status', protect, paymentController.getSubscriptionStatus);
router.post('/create-trip-payment', protect, paymentController.createTripPayment);
router.post('/finalize-trip-payment', protect, paymentController.finalizeTripPayment);
router.get('/driver/financial-status', protect, paymentController.getDriverFinancialStatus);

module.exports = router;