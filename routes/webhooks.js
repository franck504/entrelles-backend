const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const User = require('../models/User');
const { handleConnectAccountUpdate } = require('../controllers/kycController');

// ✅ WEBHOOK STRIPE - Traitement COMPLET des événements
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log('✅ Webhook signature verified:', event.type);
        
        // ✅ AJOUTER CES LOGS
        console.log('📋 Event data:', JSON.stringify(event.data.object, null, 2));
        
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {

            // 💳 === PAIEMENTS TRAJETS ===
            case 'payment_intent.created':
                await handlePaymentIntentCreated(event.data.object);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            // À ajouter dans votre webhook handler
            // case 'invoice.payment_succeeded':
            //     // Activer l'abonnement
            //     await activateSubscription(event.data.object);
            //     break;

            case 'invoice.payment_failed':
                // Désactiver l'abonnement
                await deactivateSubscription(event.data.object);
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

            // 💰 === CHARGES ET REMBOURSEMENTS ===
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
            // ✅ AJOUTER CE CASE dans le switch de handleStripeWebhook
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;


            // 📋 === ABONNEMENTS ===
            case 'customer.subscription.created':

                await handleCustomerSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':

                await handleCustomerSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':

                await handleCustomerSubscriptionDeleted(event.data.object);
                break;

            case 'customer.subscription.trial_will_end':
                await handleTrialWillEnd(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'invoice.upcoming':
                await handleInvoiceUpcoming(event.data.object);
                break;

            // 👤 === CLIENTS ===
            case 'customer.created':
                await handleCustomerCreated(event.data.object);
                break;

            case 'customer.updated':
                await handleCustomerUpdated(event.data.object);
                break;

            // 🏦 === VIREMENTS CONDUCTRICE ===
            case 'payout.created':
                await handlePayoutCreated(event.data.object);
                break;

            case 'payout.updated':
                await handlePayoutUpdated(event.data.object);
                break;

            case 'payout.paid':
                await handlePayoutPaid(event.data.object);
                break;

            case 'payout.failed':
                await handlePayoutFailed(event.data.object);
                break;

            case 'transfer.created':
                await handleTransferCreated(event.data.object);
                break;

            case 'transfer.updated':
                await handleTransferUpdated(event.data.object);
                break;

            case 'account.updated':
                await handleConnectAccountUpdate(event.data.object);
                break;

            case 'account.application.authorized':
                await handleConnectAccountUpdate(event.data.object);
                break;

            case 'account.application.deauthorized':
                await handleConnectAccountDeauthorized(event.data.object);
                break;

            default:
                console.log('ℹ️ Unhandled event type:', event.type);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

// ✅ CORRIGER CETTE FONCTION dans webhooks.js
const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log('🛒 Checkout session completed:', session.id);
    console.log('📋 Session details:', {
      mode: session.mode,
      payment_status: session.payment_status,
      subscription: session.subscription,
      metadata: session.metadata
    });
    
    // Vérifier que c'est un abonnement
    if (session.mode !== 'subscription') {
      console.log('⚠️ Not a subscription checkout, skipping');
      return;
    }

    // Vérifier que le paiement est réussi
    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed, status:', session.payment_status);
      return;
    }

    const userId = session.metadata.userId;
    if (!userId) {
      console.log('⚠️ No userId in session metadata');
      console.log('Available metadata:', session.metadata);
      return;
    }

    console.log('👤 Processing subscription for user:', userId);

    // ✅ RÉCUPÉRER L'ABONNEMENT STRIPE COMPLET
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      console.log('⚠️ No subscription ID in session');
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    console.log('📋 Subscription retrieved:', {
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end
    });

    // ✅ MISE À JOUR IDENTIQUE À /subscribe
    const updateData = {
      // Stripe IDs
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.stripeCustomerId': session.customer,
      
      // Statut (EXACTEMENT comme /subscribe)
      'subscription.status': subscription.status,
      'subscription.plan': 'premium',
      'subscription.isActive': subscription.status === 'active',
      
      // Dates (EXACTEMENT comme /subscribe)
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      
      // Tracking
      'subscription.activatedAt': new Date(),
      'subscription.activatedVia': 'checkout'
    };

    console.log('💾 Updating user with data:', updateData);

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { 
      new: true,
      runValidators: true 
    });

    if (updatedUser) {
      console.log('✅ User subscription activated via checkout:', {
        userId: userId,
        email: updatedUser.email,
        plan: updatedUser.subscription.plan,
        isActive: updatedUser.subscription.isActive,
        status: updatedUser.subscription.status,
        stripeSubscriptionId: updatedUser.subscription.stripeSubscriptionId
      });
      
      // ✅ VÉRIFICATION FINALE
      console.log('🔍 Final subscription state:', {
        isActive: updatedUser.subscription.isActive,
        plan: updatedUser.subscription.plan,
        status: updatedUser.subscription.status
      });
      
    } else {
      console.error('❌ User not found for ID:', userId);
    }

  } catch (error) {
    console.error('❌ Error processing checkout completion:', error);
    console.error('Stack trace:', error.stack);
  }
};

// 💳 === FONCTIONS PAIEMENTS TRAJETS ===

// ✅ DÉJÀ IMPLÉMENTÉ
const handlePaymentSucceeded = async (paymentIntent) => {
    try {
        console.log('✅ Processing payment success:', paymentIntent.id);

        const bookingId = paymentIntent.metadata.bookingId;
        if (!bookingId) return;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // Confirmer le paiement
        booking.payment.status = 'succeeded';
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';
        booking.confirmedAt = new Date();

        await booking.save();

        // Mettre à jour les places disponibles
        const Trip = require('../models/Trip');
        const trip = await Trip.findById(booking.trip);
        if (trip) {
            trip.availableSeats = Math.max(0, trip.availableSeats - booking.numberOfSeats);
            await trip.save();
        }

        // TODO: Programmer le virement à la conductrice (après le trajet)
        console.log(`💰 Payment confirmed: ${booking.payment.driverAmount/100}€ for driver, ${booking.payment.commissionAmount/100}€ commission`);

    } catch (error) {
        console.error('❌ Error processing payment success:', error);
    }
};

// ✅ DÉJÀ IMPLÉMENTÉ
const handlePaymentFailed = async (paymentIntent) => {
    try {
        console.log('❌ Processing payment failure:', paymentIntent.id);

        const bookingId = paymentIntent.metadata.bookingId;

        if (!bookingId) {
            console.log('⚠️ No booking ID in payment intent metadata');
            return;
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            console.log('⚠️ Booking not found:', bookingId);
            return;
        }

        booking.payment.status = 'failed';
        booking.payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
        booking.payment.failedAt = new Date();

        if (booking.status === 'confirmed') {
            booking.status = 'pending';
            booking.confirmedAt = null;

            const Trip = require('../models/Trip');
            const trip = await Trip.findById(booking.trip);
            if (trip) {
                trip.availableSeats += booking.numberOfSeats;
                await trip.save();
                console.log('✅ Trip seats restored after payment failure');
            }
        }

        await booking.save();

        console.log('✅ Payment failure processed for booking:', bookingId);

    } catch (error) {
        console.error('❌ Error processing payment failure:', error);
    }
};

// 🆕 NOUVEAU : PaymentIntent créé
const handlePaymentIntentCreated = async (paymentIntent) => {
    try {
        console.log('🆕 Payment intent created:', paymentIntent.id);

        const bookingId = paymentIntent.metadata.bookingId;

        if (!bookingId) return;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // Mettre à jour le statut
        booking.payment.status = 'processing';
        booking.payment.stripePaymentIntentId = paymentIntent.id;
        booking.payment.stripeClientSecret = paymentIntent.client_secret;

        await booking.save();

        console.log('✅ Payment intent creation processed');

    } catch (error) {
        console.error('❌ Error processing payment intent creation:', error);
    }
};

// 🆕 NOUVEAU : PaymentIntent annulé
const handlePaymentCanceled = async (paymentIntent) => {
    try {
        console.log('❌ Payment intent canceled:', paymentIntent.id);

        const bookingId = paymentIntent.metadata.bookingId;

        if (!bookingId) return;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        booking.payment.status = 'canceled';
        booking.payment.canceledAt = new Date();

        // Remettre la réservation en pending si elle était confirmée
        if (booking.status === 'confirmed') {
            booking.status = 'pending';
            booking.confirmedAt = null;
        }

        await booking.save();

        console.log('✅ Payment cancellation processed');

    } catch (error) {
        console.error('❌ Error processing payment cancellation:', error);
    }
};

// 🆕 NOUVEAU : Paiement nécessite une action
const handlePaymentRequiresAction = async (paymentIntent) => {
    try {
        console.log('⚠️ Payment requires action:', paymentIntent.id);

        const bookingId = paymentIntent.metadata.bookingId;

        if (!bookingId) return;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        booking.payment.status = 'requires_action';
        booking.payment.actionRequired = true;

        await booking.save();

        // TODO: Envoyer notification à l'utilisateur
        console.log('📧 Should notify user about required action');

    } catch (error) {
        console.error('❌ Error processing payment action required:', error);
    }
};

// 🆕 NOUVEAU : Charge réussie
const handleChargeSucceeded = async (charge) => {
    try {
        console.log('✅ Charge succeeded:', charge.id);

        // Mettre à jour les détails de la charge
        const booking = await Booking.findOne({
            'payment.stripePaymentIntentId': charge.payment_intent
        });

        if (booking) {
            booking.payment.stripeChargeId = charge.id;
            booking.payment.receiptUrl = charge.receipt_url;
            await booking.save();
        }

    } catch (error) {
        console.error('❌ Error processing charge success:', error);
    }
};

// 🆕 NOUVEAU : Charge échouée
const handleChargeFailed = async (charge) => {
    try {
        console.log('❌ Charge failed:', charge.id);

        const booking = await Booking.findOne({
            'payment.stripePaymentIntentId': charge.payment_intent
        });

        if (booking) {
            booking.payment.stripeChargeId = charge.id;
            booking.payment.failureReason = charge.failure_message;
            await booking.save();
        }

    } catch (error) {
        console.error('❌ Error processing charge failure:', error);
    }
};

// 🆕 NOUVEAU : Litige créé
const handleDisputeCreated = async (dispute) => {
    try {
        console.log('⚠️ Dispute created:', dispute.id);

        const booking = await Booking.findOne({
            'payment.stripeChargeId': dispute.charge
        });

        if (booking) {
            booking.payment.disputeId = dispute.id;
            booking.payment.disputeStatus = dispute.status;
            booking.payment.disputeReason = dispute.reason;
            await booking.save();

            // TODO: Notifier admin et utilisateurs
            console.log('📧 Should notify admin about dispute');
        }

    } catch (error) {
        console.error('❌ Error processing dispute creation:', error);
    }
};

// ✅ DÉJÀ IMPLÉMENTÉ (mais amélioré)
const handleRefundCreated = async (refund) => {
    try {
        console.log('💰 Processing refund:', refund.id);

        const paymentIntentId = refund.payment_intent || refund.charge;

        if (!paymentIntentId) {
            console.log('⚠️ No payment intent ID in refund');
            return;
        }

        const booking = await Booking.findOne({
            'payment.stripePaymentIntentId': paymentIntentId
        });

        if (!booking) {
            console.log('⚠️ Booking not found for payment intent:', paymentIntentId);
            return;
        }

        booking.payment.refundId = refund.id;
        booking.payment.refundAmount = refund.amount;
        booking.payment.refundedAt = new Date();
        booking.payment.status = 'refunded';

        if (booking.status !== 'cancelled') {
            booking.status = 'cancelled';
            booking.cancelledAt = new Date();
            booking.cancellationReason = 'Automatic cancellation due to refund';

            const Trip = require('../models/Trip');
            const trip = await Trip.findById(booking.trip);
            if (trip) {
                trip.availableSeats += booking.numberOfSeats;
                await trip.save();
                console.log('✅ Trip seats restored after refund');
            }
        }

        await booking.save();

        console.log('✅ Refund processed for booking:', booking._id);

    } catch (error) {
        console.error('❌ Error processing refund:', error);
    }
};

// 🆕 NOUVEAU : Remboursement mis à jour
const handleRefundUpdated = async (refund) => {
    try {
        console.log('💰 Processing refund update:', refund.id);

        const booking = await Booking.findOne({
            'payment.refundId': refund.id
        });

        if (booking) {
            booking.payment.refundStatus = refund.status;
            booking.payment.refundReason = refund.reason;
            await booking.save();
            console.log('✅ Refund status updated:', refund.status);
        }

    } catch (error) {
        console.error('❌ Error processing refund update:', error);
    }
};

// 📋 === FONCTIONS ABONNEMENTS ===

// 🆕 NOUVEAU : Abonnement créé
const handleSubscriptionCreated = async (subscription) => {
    try {
        console.log('📋 Subscription created:', subscription.id);

        const user = await User.findOne({
            'subscription.stripeCustomerId': subscription.customer
        });

        if (user) {
            user.subscription.stripeSubscriptionId = subscription.id;
            user.subscription.status = subscription.status;
            user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
            user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            user.subscription.plan = subscription.items.data[0]?.price?.nickname || 'premium';

            await user.save();
            console.log('✅ Subscription created for user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing subscription creation:', error);
    }
};

// 🆕 NOUVEAU : Abonnement mis à jour
const handleSubscriptionUpdated = async (subscription) => {
    try {
        console.log('🔄 Subscription updated:', subscription.id);

        const user = await User.findOne({
            'subscription.stripeSubscriptionId': subscription.id
        });

        if (user) {
            user.subscription.status = subscription.status;
            user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
            user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;

            // Si annulé, passer en plan gratuit
            if (subscription.status === 'canceled') {
                user.subscription.plan = 'free';
            }

            await user.save();
            console.log('✅ Subscription updated for user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing subscription update:', error);
    }
};

// 🆕 NOUVEAU : Abonnement supprimé
const handleSubscriptionDeleted = async (subscription) => {
    try {
        console.log('🗑️ Subscription deleted:', subscription.id);

        const user = await User.findOne({
            'subscription.stripeSubscriptionId': subscription.id
        });

        if (user) {
            user.subscription.status = 'canceled';
            user.subscription.plan = 'free';
            user.subscription.cancelAtPeriodEnd = false;

            await user.save();
            console.log('✅ Subscription canceled for user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing subscription deletion:', error);
    }
};

// 🆕 NOUVEAU : Fin d'essai approche
const handleTrialWillEnd = async (subscription) => {
    try {
        console.log('⏰ Trial will end:', subscription.id);

        const user = await User.findOne({
            'subscription.stripeSubscriptionId': subscription.id
        });

        if (user) {
            // TODO: Envoyer notification fin d'essai
            console.log('📧 Should notify user about trial ending:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing trial will end:', error);
    }
};

// 🆕 NOUVEAU : Paiement facture réussi
const handleInvoicePaymentSucceeded = async (invoice) => {
    try {
        console.log('💰 Invoice payment succeeded:', invoice.id);

        if (!invoice.subscription) return;

        const user = await User.findOne({
            'subscription.stripeCustomerId': invoice.customer
        });

        if (user) {
            user.subscription.status = 'active';
            user.subscription.lastPaymentDate = new Date();

            await user.save();
            console.log('✅ Invoice payment processed for user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing invoice payment success:', error);
    }
};

// 🆕 NOUVEAU : Paiement facture échoué
const handleInvoicePaymentFailed = async (invoice) => {
    try {
        console.log('❌ Invoice payment failed:', invoice.id);

        if (!invoice.subscription) return;

        const user = await User.findOne({
            'subscription.stripeCustomerId': invoice.customer
        });

        if (user) {
            user.subscription.status = 'past_due';

            await user.save();
            console.log('⚠️ Invoice payment failed for user:', user.email);

            // TODO: Envoyer notification échec paiement
            console.log('📧 Should notify user about payment failure');
        }

    } catch (error) {
        console.error('❌ Error processing invoice payment failure:', error);
    }
};

// 🆕 NOUVEAU : Facture à venir
const handleInvoiceUpcoming = async (invoice) => {
    try {
        console.log('📅 Upcoming invoice:', invoice.id);

        const user = await User.findOne({
            'subscription.stripeCustomerId': invoice.customer
        });

        if (user) {
            // TODO: Envoyer notification facture à venir
            console.log('📧 Should notify user about upcoming invoice:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing upcoming invoice:', error);
    }
};

// 👤 === FONCTIONS CLIENTS ===

// 🆕 NOUVEAU : Client créé
const handleCustomerCreated = async (customer) => {
    try {
        console.log('👤 Customer created:', customer.id);

        const user = await User.findOne({ email: customer.email });

        if (user) {
            user.subscription.stripeCustomerId = customer.id;
            await user.save();
            console.log('✅ Customer linked to user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing customer creation:', error);
    }
};

// 🆕 NOUVEAU : Client mis à jour
const handleCustomerUpdated = async (customer) => {
    try {
        console.log('👤 Customer updated:', customer.id);

        const user = await User.findOne({
            'subscription.stripeCustomerId': customer.id
        });

        if (user) {
            // Mettre à jour les infos si nécessaire
            console.log('✅ Customer update processed for user:', user.email);
        }

    } catch (error) {
        console.error('❌ Error processing customer update:', error);
    }
};

// 🏦 === FONCTIONS VIREMENTS CONDUCTRICE ===

// 🆕 NOUVEAU : Virement créé
const handlePayoutCreated = async (payout) => {
    try {
        console.log('🏦 Payout created:', payout.id);

        // Trouver les réservations concernées par ce virement
        const bookings = await Booking.find({
            'payment.driverPayout.stripePayoutId': payout.id
        });

        for (const booking of bookings) {
            booking.payment.driverPayout.status = 'created';
            booking.payment.driverPayout.createdAt = new Date();
            await booking.save();
        }

        console.log('✅ Payout creation processed for', bookings.length, 'bookings');

    } catch (error) {
        console.error('❌ Error processing payout creation:', error);
    }
};

// 🆕 NOUVEAU : Virement mis à jour
const handlePayoutUpdated = async (payout) => {
    try {
        console.log('🏦 Payout updated:', payout.id, 'Status:', payout.status);

        const bookings = await Booking.find({
            'payment.driverPayout.stripePayoutId': payout.id
        });

        for (const booking of bookings) {
            booking.payment.driverPayout.status = payout.status;
            booking.payment.driverPayout.updatedAt = new Date();

            if (payout.failure_message) {
                booking.payment.driverPayout.failureReason = payout.failure_message;
            }

            await booking.save();
        }

        console.log('✅ Payout update processed for', bookings.length, 'bookings');

    } catch (error) {
        console.error('❌ Error processing payout update:', error);
    }
};

// 🆕 NOUVEAU : Virement payé
const handlePayoutPaid = async (payout) => {
    try {
        console.log('💰 Payout paid:', payout.id);

        const bookings = await Booking.find({
            'payment.driverPayout.stripePayoutId': payout.id
        });

        for (const booking of bookings) {
            booking.payment.driverPayout.status = 'paid';
            booking.payment.driverPayout.paidAt = new Date();
            await booking.save();
        }

        console.log('✅ Payout payment processed for', bookings.length, 'bookings');

    } catch (error) {
        console.error('❌ Error processing payout payment:', error);
    }
};

// 🆕 NOUVEAU : Virement échoué
const handlePayoutFailed = async (payout) => {
    try {
        console.log('❌ Payout failed:', payout.id);

        const bookings = await Booking.find({
            'payment.driverPayout.stripePayoutId': payout.id
        });

        for (const booking of bookings) {
            booking.payment.driverPayout.status = 'failed';
            booking.payment.driverPayout.failureReason = payout.failure_message;
            booking.payment.driverPayout.failedAt = new Date();
            await booking.save();
        }

        console.log('✅ Payout failure processed for', bookings.length, 'bookings');

    } catch (error) {
        console.error('❌ Error processing payout failure:', error);
    }
};

// 🆕 NOUVEAU : Transfert créé
const handleTransferCreated = async (transfer) => {
    try {
        console.log('🔄 Transfer created:', transfer.id);

        // Lier le transfert aux réservations si nécessaire
        if (transfer.metadata && transfer.metadata.bookingId) {
            const booking = await Booking.findById(transfer.metadata.bookingId);
            if (booking) {
                booking.payment.driverPayout.stripeTransferId = transfer.id;
                await booking.save();
            }
        }

    } catch (error) {
        console.error('❌ Error processing transfer creation:', error);
    }
};

// 🆕 NOUVEAU : Transfert mis à jour
const handleTransferUpdated = async (transfer) => {
    try {
        console.log('🔄 Transfer updated:', transfer.id);

        const booking = await Booking.findOne({
            'payment.driverPayout.stripeTransferId': transfer.id
        });

        if (booking) {
            booking.payment.driverPayout.transferStatus = transfer.status;
            await booking.save();
        }

    } catch (error) {
        console.error('❌ Error processing transfer update:', error);
    }
};

// ✅ MIDDLEWARE : Parser raw body pour webhook
const rawBodyParser = (req, res, next) => {
    if (req.originalUrl === '/api/webhooks/stripe') {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            req.body = data;
            next();
        });
    } else {
        next();
    }
};

// Route webhook (pas de protection auth)
router.post('/stripe', rawBodyParser, handleStripeWebhook);

module.exports = router;