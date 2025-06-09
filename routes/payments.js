const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  verifyCheckoutSession,
  createPortalSession,
  getSubscriptionStatus
} = require('../controllers/paymentController');

// ✅ ROUTE PUBLIQUE EN PREMIER
router.get('/verify-checkout', verifyCheckoutSession);

// Routes protégées
router.use(protect);

router.post('/create-checkout', createCheckoutSession);
router.post('/create-portal', createPortalSession);
router.get('/subscription-status', getSubscriptionStatus);

module.exports = router;