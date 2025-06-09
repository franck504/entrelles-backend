const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  verifyCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription
} = require('../controllers/paymentController');

// ✅ ROUTES PUBLIQUES EN PREMIER (avant protect)
router.get('/verify-checkout', verifyCheckoutSession);

// ✅ MAINTENANT on applique la protection
router.use(protect);

// Routes protégées
router.post('/create-checkout', createCheckoutSession);
router.post('/create-portal', createPortalSession);
router.get('/subscription-status', getSubscriptionStatus);
router.post('/cancel-subscription', cancelSubscription);
router.post('/reactivate-subscription', reactivateSubscription);

module.exports = router;