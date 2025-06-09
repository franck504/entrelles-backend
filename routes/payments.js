const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription
} = require('../controllers/paymentController');

// Routes protégées
router.use(protect);

router.post('/create-checkout', createCheckoutSession);
router.post('/create-portal', createPortalSession);
router.get('/subscription-status', getSubscriptionStatus);
router.post('/cancel-subscription', cancelSubscription);
router.post('/reactivate-subscription', reactivateSubscription);

module.exports = router;