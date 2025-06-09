const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/webhookController');

// Webhook Stripe (raw body needed)
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;