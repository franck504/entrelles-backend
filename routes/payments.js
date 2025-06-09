const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  verifyCheckoutSession,
  createPortalSession,
  getSubscriptionStatus
} = require('../controllers/paymentController');

// Routes protégées
router.use(protect);

// Routes principales
router.post('/create-checkout', createCheckoutSession);
router.post('/create-portal', createPortalSession);
router.get('/subscription-status', getSubscriptionStatus);

// Route publique pour vérification
router.get('/verify-checkout', verifyCheckoutSession);

module.exports = router;