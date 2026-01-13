const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// ✅ ABONNEMENT PRODUCTION - Stripe Checkout Session
// Suppression de l'endpoint de simulation createAndActivateSubscription

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

// ✅ PAIEMENT TRAJET PRODUCTION - Stripe Checkout Session
// Suppression des endpoints de simulation createTripPayment et finalizeTripPayment

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

    // ✅ SÉCURITÉ : Bloquer le paiement si la réservation n'est pas confirmée par la conductrice
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'La réservation doit être confirmée par la conductrice avant de pouvoir procéder au paiement.',
        currentStatus: booking.status
      });
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

// ✅ NOUVEAU : RÉCUPÉRER LE SOLDE DU PORTEFEUILLE (Format standardisé pour le Frontend)
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const kycStatus = user.getKycStatus();

    // Valeurs par défaut si pas de compte Connect
    let balanceData = {
      available: 0,
      pending: 0,
      currency: 'eur'
    };

    if (kycStatus.hasConnectAccount) {
      const stripeBalance = await stripe.balance.retrieve({
        stripeAccount: kycStatus.connectAccountId
      });

      balanceData = {
        available: stripeBalance.available.reduce((sum, bal) => sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0),
        pending: stripeBalance.pending.reduce((sum, bal) => sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0),
        currency: 'EUR'
      };
    }

    // Récupérer aussi les dernières transactions pour le modèle Wallet
    let transactions = [];
    if (kycStatus.hasConnectAccount) {
      const stripeTransactions = await stripe.balanceTransactions.list(
        { limit: 10 },
        { stripeAccount: kycStatus.connectAccountId }
      );

      transactions = stripeTransactions.data.map(tx => ({
        id: tx.id,
        amount: tx.amount / 100,
        currency: tx.currency,
        status: tx.status,
        type: tx.type === 'payout' ? 'payout' : (tx.amount > 0 ? 'payment' : 'refund'),
        date: new Date(tx.created * 1000),
        description: tx.description
      }));
    }

    res.json({
      success: true,
      data: {
        balance: balanceData,
        transactions: transactions
      }
    });

  } catch (error) {
    console.error('❌ Error getWalletBalance:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du solde' });
  }
};

// ✅ NOUVEAU : RÉCUPÉRER LES VIREMENTS
const getWalletPayouts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.stripe?.connectAccountId) {
      return res.json({ success: true, data: [] });
    }

    const stripePayouts = await stripe.payouts.list(
      { limit: 20 },
      { stripeAccount: user.stripe.connectAccountId }
    );

    const formattedPayouts = stripePayouts.data.map(payout => ({
      id: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      status: payout.status,
      date: new Date(payout.arrival_date * 1000),
      created: new Date(payout.created * 1000),
      description: `Virement vers ${payout.bank_account?.bank_name || 'compte bancaire'}`
    }));

    res.json({
      success: true,
      data: formattedPayouts
    });

  } catch (error) {
    console.error('❌ Error getWalletPayouts:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des virements' });
  }
};

// ✅ EXPORTS FINAUX - Endpoints Production Uniquement
module.exports = {
  createCheckoutSession,           // Abonnement Premium via Stripe Checkout
  getSubscriptionStatus,           // Statut abonnement utilisateur
  createTripCheckoutSession,       // Paiement trajet via Stripe Checkout
  getDriverFinancialStatus,        // Statut financier conductrice (complet)
  getWalletBalance,                // Nouveau : Formaté pour le Wallet mobile
  getWalletPayouts                 // Nouveau : Virements seuls
};
