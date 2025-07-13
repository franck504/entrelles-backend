const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// ✅ ABONNEMENT ONE-SHOT
const createAndActivateSubscription = async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;
    
    console.log('🚀 One-shot subscription for user:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.subscription?.isActive) {
      return res.status(400).json({ success: false, message: 'Already subscribed' });
    }

    // 1️⃣ Créer customer
    let customerId = user.stripe?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.displayName,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(userId, { 'stripe.customerId': customerId });
    }

    // 2️⃣ Créer abonnement
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId: userId.toString(), plan: 'premium' }
    });

    // 3️⃣ Confirmer automatiquement le paiement
    if (subscription.latest_invoice?.payment_intent) {
      await stripe.paymentIntents.confirm(
        subscription.latest_invoice.payment_intent.id,
        { 
          payment_method: 'pm_card_visa',
          return_url: 'https://entrelles-backend.vercel.app/api/payments/return'
        }
      );
    }

    // 4️⃣ Récupérer le statut final
    const finalSubscription = await stripe.subscriptions.retrieve(subscription.id);

    // 5️⃣ Sauvegarder en base
    await User.findByIdAndUpdate(userId, {
      'subscription.stripeSubscriptionId': finalSubscription.id,
      'subscription.status': finalSubscription.status,
      'subscription.plan': 'premium',
      'subscription.isActive': finalSubscription.status === 'active',
      'subscription.currentPeriodStart': new Date(finalSubscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(finalSubscription.current_period_end * 1000)
    });

    res.status(201).json({
      success: true,
      message: finalSubscription.status === 'active' ? 
        '🎉 Bienvenue dans Entrelles Premium !' : 
        'Abonnement en cours de traitement',
      subscription: {
        id: finalSubscription.id,
        status: finalSubscription.status,
        isActive: finalSubscription.status === 'active',
        plan: 'premium'
      }
    });

  } catch (error) {
    console.error('❌ Subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message
    });
  }
};

// ✅ STATUT ABONNEMENT
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      subscription: user.subscription || {
        plan: 'free',
        isActive: false,
        status: 'inactive'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error getting subscription status' });
  }
};

// ✅ PAIEMENT TRAJET
const createTripPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    console.log('💳 Creating trip payment for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
      .populate('trip', 'distance departure arrival departureDateTime driver')
      .populate('passenger', 'email profile.displayName stripe.customerId')
      .populate('driver', 'profile.displayName email kyc stripe.connectAccountId');

    if (!booking || booking.passenger._id.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Calculer montants
    const distance = booking.trip.distance || 100;
    const seats = booking.numberOfSeats;
    const driverAmountEur = distance * seats * 0.45;
    const commissionAmountEur = distance * seats * 0.10;
    const totalAmountEur = driverAmountEur + commissionAmountEur;

    const driverAmount = Math.round(driverAmountEur * 100);
    const commissionAmount = Math.round(commissionAmountEur * 100);
    const totalAmount = Math.round(totalAmountEur * 100);

    // Créer customer si nécessaire
    let customerId = booking.passenger.stripe?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: booking.passenger.email,
        name: booking.passenger.profile.displayName
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(booking.passenger._id, { 'stripe.customerId': customerId });
    }

    // Vérifier KYC conductrice
    const driverKycStatus = booking.driver.getKycStatus ? booking.driver.getKycStatus() : { canReceivePayments: false };
    const driverConnectAccountId = driverKycStatus.connectAccountId || booking.driver.stripe?.connectAccountId;
    const canCreateTransfer = driverKycStatus.canReceivePayments && driverConnectAccountId;

    // Créer PaymentIntent
    let paymentIntent;
    if (canCreateTransfer) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'eur',
        customer: customerId,
        description: `Trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        transfer_data: { destination: driverConnectAccountId, amount: driverAmount },
        metadata: { bookingId: bookingId.toString(), type: 'trip_payment' }
      });
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'eur',
        customer: customerId,
        description: `Trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city} (KYC pending)`,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { bookingId: bookingId.toString(), type: 'trip_payment', holdForKyc: 'true' }
      });
    }

    // Sauvegarder
    booking.payment = {
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      currency: 'eur',
      status: 'processing',
      driverAmount: driverAmount,
      commissionAmount: commissionAmount
    };
    await booking.save();

    res.status(201).json({
      success: true,
      message: canCreateTransfer ? 'Payment created with automatic transfer' : 'Payment created - KYC pending',
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        currency: 'eur'
      },
      breakdown: {
        totalEur: totalAmountEur,
        driverEur: driverAmountEur,
        commissionEur: commissionAmountEur
      }
    });

  } catch (error) {
    console.error('❌ Create trip payment error:', error);
    res.status(500).json({ success: false, message: 'Error creating trip payment', error: error.message });
  }
};

// ✅ FINALISER PAIEMENT TRAJET
const finalizeTripPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    console.log('🎯 Finalizing payment for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
      .populate('trip', 'departure arrival')
      .populate('passenger', 'profile.displayName');

    if (!booking || booking.passenger._id.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.payment?.stripePaymentIntentId) {
      return res.status(400).json({ success: false, message: 'No payment to finalize' });
    }

    // Confirmer avec carte test
    const paymentIntent = await stripe.paymentIntents.confirm(
      booking.payment.stripePaymentIntentId,
      { payment_method: 'pm_card_visa' }
    );

    if (paymentIntent.status === 'succeeded') {
      booking.payment.status = 'succeeded';
      booking.payment.paidAt = new Date();
      booking.status = 'confirmed';
      booking.confirmedAt = new Date();
      await booking.save();

      res.status(200).json({
        success: true,
        message: '🎉 Paiement finalisé avec succès !',
        booking: {
          id: booking._id,
          status: booking.status,
          amount: booking.payment.amount / 100
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        status: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('❌ Finalize payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finalizing payment',
      error: error.message
    });
  }
};

// ✅ STATUT FINANCIER CONDUCTEUR
const getDriverFinancialStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Statut KYC
    const kycStatus = user.getKycStatus();
    let balance = null;
    let payouts = null;

    // Balance si compte vérifié
    if (kycStatus.hasConnectAccount && kycStatus.canReceivePayments) {
      try {
        const stripeBalance = await stripe.balance.retrieve({
          stripeAccount: kycStatus.connectAccountId
        });

        balance = {
          available: stripeBalance.available,
          pending: stripeBalance.pending,
          totalAvailable: stripeBalance.available.reduce((sum, bal) =>
            sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0),
          totalPending: stripeBalance.pending.reduce((sum, bal) =>
            sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0)
        };

        // Derniers virements
        const stripePayouts = await stripe.payouts.list({ limit: 10 },
          { stripeAccount: kycStatus.connectAccountId });

        payouts = stripePayouts.data.map(payout => ({
          id: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency,
          status: payout.status,
          arrivalDate: new Date(payout.arrival_date * 1000),
          createdAt: new Date(payout.created * 1000)
        }));

      } catch (error) {
        console.error('Erreur récupération balance:', error);
      }
    }

    res.json({
      success: true,
      data: {
        kyc: kycStatus,
        balance,
        payouts,
        summary: {
          hasStripeAccount: kycStatus.hasConnectAccount,
          isVerified: kycStatus.status === 'verified',
          canReceivePayments: kycStatus.canReceivePayments,
          canReceivePayouts: kycStatus.canReceivePayouts || false,
          availableBalance: balance?.totalAvailable || 0,
          pendingBalance: balance?.totalPending || 0
        }
      }
    });

  } catch (error) {
    console.error('Erreur statut financier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ CRÉER CHECKOUT SESSION POUR PAIEMENT TRAJET
const createTripCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    console.log('🛒 Creating trip checkout session for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
      .populate('trip', 'distance departure arrival departureDateTime driver')
      .populate('passenger', 'email profile.displayName stripe.customerId')
      .populate('driver', 'profile.displayName email kyc stripe.connectAccountId');

    if (!booking || booking.passenger._id.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Calcul montants identique au paiement direct
    const distance = booking.trip.distance || 100;
    const seats = booking.numberOfSeats;
    const driverAmountEur = distance * seats * 0.45;
    const commissionAmountEur = distance * seats * 0.10;
    const totalAmountEur = driverAmountEur + commissionAmountEur;

    const driverAmount = Math.round(driverAmountEur * 100);
    const commissionAmount = Math.round(commissionAmountEur * 100);
    const totalAmount = Math.round(totalAmountEur * 100);

    // Créer/récupérer customer Stripe pour la passagère
    let customerId = booking.passenger.stripe?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: booking.passenger.email,
        name: booking.passenger.profile.displayName,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(booking.passenger._id, { 'stripe.customerId': customerId });
    }

    // Vérifier KYC conductrice
    const driverKycStatus = booking.driver.getKycStatus ? booking.driver.getKycStatus() : { canReceivePayments: false };
    const driverConnectAccountId = driverKycStatus.connectAccountId || booking.driver.stripe?.connectAccountId;
    const canCreateTransfer = driverKycStatus.canReceivePayments && driverConnectAccountId;

    // Créer Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
          },
          unit_amount: totalAmount,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        transfer_data: canCreateTransfer ? {
          destination: driverConnectAccountId,
          amount: driverAmount
        } : undefined,
        metadata: {
          bookingId: bookingId.toString(),
          type: 'trip_payment',
          holdForKyc: canCreateTransfer ? 'false' : 'true'
        }
      },
      success_url: 'entrelles://trip-payment-success?session_id={CHECKOUT_SESSION_ID}&booking_id=' + bookingId + '&status=success',
      cancel_url: 'entrelles://trip-payment-cancel?session_id={CHECKOUT_SESSION_ID}&booking_id=' + bookingId + '&status=cancel',
      metadata: {
        bookingId: bookingId.toString(),
        type: 'trip_payment',
        created_at: new Date().toISOString()
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 min
    });

    // Sauvegarder la session dans le booking
    booking.payment = {
      stripeCheckoutSessionId: session.id,
      url: session.url,
      amount: totalAmount,
      currency: 'eur',
      status: 'pending',
      driverAmount: driverAmount,
      commissionAmount: commissionAmount
    };
    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Checkout session created',
      url: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at,
      breakdown: {
        totalEur: totalAmountEur,
        driverEur: driverAmountEur,
        commissionEur: commissionAmountEur
      }
    });

  } catch (error) {
    console.error('❌ Trip checkout session error:', error);
    res.status(500).json({ success: false, message: 'Error creating trip checkout session', error: error.message });
  }
};

const createCheckoutSession = async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;
    
    console.log('🛒 Creating checkout session for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.subscription?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed'
      });
    }

    // 1️⃣ Créer/récupérer customer
    let customerId = user.stripe?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.displayName,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(userId, {
        'stripe.customerId': customerId
      });
    }

    // 2️⃣ Créer session checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: 'entrelles://payment-success?session_id={CHECKOUT_SESSION_ID}&status=success&user_id=' + userId,
      cancel_url: 'entrelles://payment-cancel?session_id={CHECKOUT_SESSION_ID}&status=cancel&user_id=' + userId,
      
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      
      metadata: {
        userId: userId.toString(), // ✅ CRUCIAL POUR LE WEBHOOK
        plan: 'premium',
        created_at: new Date().toISOString()
      },
      
      subscription_data: {
        metadata: {
          userId: userId.toString(), // ✅ CRUCIAL POUR LE WEBHOOK
          plan: 'premium',
          created_at: new Date().toISOString()
        },
      },

      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    });

    // ✅ SAUVEGARDER LA SESSION POUR TRACKING
    await User.findByIdAndUpdate(userId, {
      'stripe.lastCheckoutSession': {
        sessionId: session.id,
        url: session.url,
        createdAt: new Date(),
        status: 'pending'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Checkout session created',
      url: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at,
      customerId: customerId
    });

  } catch (error) {
    console.error('❌ Checkout session error:', error);
    
    let errorMessage = 'Error creating checkout session';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = 'Erreur de carte bancaire';
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Requête invalide vers Stripe';
      statusCode = 400;
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Erreur API Stripe temporaire';
      statusCode = 502;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ EXPORTS FINAUX
module.exports = {
  createAndActivateSubscription,
  createCheckoutSession,
  getSubscriptionStatus,
  createTripPayment,
  createTripCheckoutSession,
  finalizeTripPayment,
  getDriverFinancialStatus
};
