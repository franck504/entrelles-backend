const express = require('express');
const router = express.Router();
const { handleStripeWebhook, simulatePayment } = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');

// Webhook Stripe (raw body needed)
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// ✅ AJOUTER : Simulation de paiement (développement uniquement)
router.post('/simulate-payment', protect, simulatePayment);
module.exports = router;