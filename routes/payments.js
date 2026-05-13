const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Authentification requise pour toutes les opérations de paiement
router.use(protect);

// Gestion de l'abonnement Premium (Stripe Checkout)
router.post('/create-checkout', paymentController.createCheckoutSession);
router.get('/subscription-status', paymentController.getSubscriptionStatus);

// Paiement des trajets partagés
router.post('/create-trip-checkout', paymentController.createTripCheckoutSession);

// Informations financières pour les conductrices (Stripe Connect)
router.get('/driver/financial-status', paymentController.getDriverFinancialStatus);
router.get('/balance', paymentController.getWalletBalance);
router.get('/payouts', paymentController.getWalletPayouts);

module.exports = router;