const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const User = require('../models/User');
const { handleConnectAccountUpdate } = require('../controllers/kycController');

/**
 * Gestionnaire principal des webhooks Stripe
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Erreur de vérification de signature du webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // Événements liés aux paiements (Trajets)
      case 'payment_intent.created':
        await handlePaymentIntentCreated(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;
      case 'payment_intent.requires_action':
        await handlePaymentRequiresAction(event.data.object);
        break;

      // Événements liés aux charges et remboursements
      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object);
        break;
      case 'charge.failed':
        await handleChargeFailed(event.data.object);
        break;
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object);
        break;
      case 'refund.created':
        await handleRefundCreated(event.data.object);
        break;
      case 'refund.updated':
        await handleRefundUpdated(event.data.object);
        break;

      // Événements liés aux Checkout Sessions (Abonnements et Trajets)
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      // Événements liés aux abonnements
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      // Événements liés aux comptes Connect (KYC)
      case 'account.updated':
        await handleConnectAccountUpdate(event.data.object);
        break;

      default:
        // Type d'événement non géré explicitement
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(500).json({ error: 'Échec du traitement du webhook' });
  }
};

/**
 * Gère la finalisation d'une session Checkout (Abonnement ou Trajet)
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    // Cas de l'abonnement Premium
    if (session.mode === 'subscription' && session.payment_status === 'paid') {
      const userId = session.metadata.userId;
      if (!userId) return;

      const subscriptionId = session.subscription;
      if (!subscriptionId) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await User.findByIdAndUpdate(userId, {
        'subscription.stripeSubscriptionId': subscription.id,
        'subscription.stripeCustomerId': session.customer,
        'subscription.status': subscription.status,
        'subscription.plan': 'premium',
        'subscription.isActive': subscription.status === 'active',
        'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
        'subscription.activatedAt': new Date()
      });
    }
  } catch (error) {
    console.error('Erreur traitement checkout session:', error);
  }
};

/**
 * Gère la réussite du paiement d'un trajet
 */
const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    booking.payment.stripePaymentIntentId = paymentIntent.id;
    booking.payment.status = 'succeeded';
    booking.payment.paidAt = new Date();
    booking.status = 'paid';
    await booking.save();

  } catch (error) {
    console.error('Erreur traitement réussite paiement:', error);
  }
};

/**
 * Gère l'échec du paiement d'un trajet
 */
const handlePaymentFailed = async (paymentIntent) => {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    booking.payment.status = 'failed';
    booking.payment.failureReason = paymentIntent.last_payment_error?.message || 'Paiement échoué';
    booking.payment.failedAt = new Date();

    if (booking.status === 'confirmed') {
      booking.status = 'pending';
      booking.confirmedAt = null;

      const Trip = require('../models/Trip');
      const trip = await Trip.findById(booking.trip);
      if (trip) {
        trip.availableSeats += booking.numberOfSeats;
        await trip.save();
      }
    }
    await booking.save();
  } catch (error) {
    console.error('Erreur traitement échec paiement:', error);
  }
};

// Fonctions de support pour les autres événements
const handlePaymentIntentCreated = async (pi) => { /* Logique minimale */ };
const handlePaymentCanceled = async (pi) => { /* Logique minimale */ };
const handlePaymentRequiresAction = async (pi) => { /* Logique minimale */ };
const handleChargeSucceeded = async (charge) => {
  const booking = await Booking.findOne({ 'payment.stripePaymentIntentId': charge.payment_intent });
  if (booking) {
    booking.payment.stripeChargeId = charge.id;
    booking.payment.receiptUrl = charge.receipt_url;
    await booking.save();
  }
};
const handleChargeFailed = async (charge) => { /* Logique minimale */ };
const handleDisputeCreated = async (dispute) => { /* Logique minimale */ };
const handleRefundCreated = async (refund) => {
  const piId = refund.payment_intent || refund.charge;
  if (!piId) return;
  const booking = await Booking.findOne({ 'payment.stripePaymentIntentId': piId });
  if (booking) {
    booking.payment.refundId = refund.id;
    booking.payment.status = 'refunded';
    booking.status = 'cancelled';
    await booking.save();
  }
};
const handleRefundUpdated = async (refund) => { /* Logique minimale */ };
const handleSubscriptionCreated = async (sub) => { /* Logique minimale */ };
const handleSubscriptionUpdated = async (sub) => {
  const user = await User.findOne({ 'subscription.stripeSubscriptionId': sub.id });
  if (user) {
    user.subscription.status = sub.status;
    user.subscription.isActive = sub.status === 'active';
    await user.save();
  }
};
const handleSubscriptionDeleted = async (sub) => {
  const user = await User.findOne({ 'subscription.stripeSubscriptionId': sub.id });
  if (user) {
    user.subscription.status = 'canceled';
    user.subscription.isActive = false;
    user.subscription.plan = 'free';
    await user.save();
  }
};
const handleInvoicePaymentSucceeded = async (inv) => { /* Logique minimale */ };
const handleInvoicePaymentFailed = async (inv) => { /* Logique minimale */ };

// Route du webhook (nécessite le body brut pour la vérification Stripe)
router.post('/', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;