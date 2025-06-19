const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { protect } = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const User = require('../models/User');


// ✅ IMPORT DU CONTROLLER
const {
  getPaymentStats,      //🆗
  createSubscription,   //🆗
  cancelSubscription,   //🆗
  getSubscriptionStatus,//🆗
  createTripPayment,    //🆗
  confirmTripPayment,   //🆗
  finalizeTripPayment ,  //🆗
  completeSubscriptionSetup
} = require('../controllers/paymentController');

// ✅ ROUTES PROTÉGÉES
router.use(protect);


// Routes du controller
router.get('/stats', getPaymentStats);
router.post('/create-subscription', createSubscription);
router.post('/cancel-subscription', cancelSubscription);
// Ajouter après les routes existantes
// router.post('/confirm-subscription-payment', confirmSubscriptionPayment);

router.get('/subscription-status', getSubscriptionStatus);
router.post('/create-trip-payment', createTripPayment);
router.post('/confirm-trip-payment', confirmTripPayment);
router.post('/finalize-trip-payment', finalizeTripPayment); // ✅ UNE SEULE DÉFINITION

router.post('/complete-subscription-setup', completeSubscriptionSetup);


module.exports = router;