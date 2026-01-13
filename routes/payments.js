const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// ✅ ROUTES PRODUCTION - Stripe Checkout Uniquement
// Abonnement Premium
router.post('/create-checkout', protect, paymentController.createCheckoutSession);
router.get('/subscription-status', protect, paymentController.getSubscriptionStatus);

// Paiement Trajets
router.post('/create-trip-checkout', protect, paymentController.createTripCheckoutSession);

// Statut Financier Conductrice
router.get('/driver/financial-status', protect, paymentController.getDriverFinancialStatus);
router.get('/balance', protect, paymentController.getWalletBalance);
router.get('/payouts', protect, paymentController.getWalletPayouts);

module.exports = router;

//webhooks key corriged