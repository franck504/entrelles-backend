const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

/**
 * @desc    Obtenir le statut de l'abonnement de l'utilisateur
 * @route   GET /api/payments/subscription-status
 * @access  Privé
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
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
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du statut d\'abonnement' });
  }
};

/**
 * @desc    Obtenir le statut financier complet de la conductrice (Balance Stripe)
 * @route   GET /api/payments/financial-status
 * @access  Privé
 */
const getDriverFinancialStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const kycStatus = user.getKycStatus();
    let balance = null;
    let payouts = null;

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
        console.error('Erreur récupération balance Stripe:', error);
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * @desc    Créer une session Stripe Checkout pour le paiement d'un trajet
 * @route   POST /api/payments/create-trip-checkout
 * @access  Privé
 */
const createTripCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate('trip', 'distance departure arrival departureDateTime driver')
      .populate('passenger', 'email profile.displayName stripe.customerId')
      .populate('driver', 'profile.displayName email kyc stripe.connectAccountId');

    if (!booking || booking.passenger._id.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Réservation non trouvée' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'La réservation doit être confirmée par la conductrice avant le paiement.'
      });
    }

    const distance = booking.trip.distance || 0;
    const seats = booking.numberOfSeats;
    const driverAmountEur = distance * seats * 0.45;
    const commissionAmountEur = distance * seats * 0.10;
    const totalAmountEur = driverAmountEur + commissionAmountEur;

    const driverAmount = Math.round(driverAmountEur * 100);
    const totalAmount = Math.round(totalAmountEur * 100);

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

    const driverKycStatus = booking.driver.getKycStatus ? booking.driver.getKycStatus() : { canReceivePayments: false };
    const driverConnectAccountId = driverKycStatus.connectAccountId || booking.driver.stripe?.connectAccountId;
    const canCreateTransfer = driverKycStatus.canReceivePayments && driverConnectAccountId;

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
          type: 'trip_payment'
        }
      },
      success_url: 'entrelles://trip-payment-success?session_id={CHECKOUT_SESSION_ID}&booking_id=' + bookingId,
      cancel_url: 'entrelles://trip-payment-cancel?session_id={CHECKOUT_SESSION_ID}&booking_id=' + bookingId,
      metadata: { bookingId: bookingId.toString(), type: 'trip_payment' }
    });

    booking.payment = {
      stripeCheckoutSessionId: session.id,
      url: session.url,
      amount: totalAmount,
      currency: 'eur',
      status: 'pending',
      driverAmount: driverAmount,
      commissionAmount: Math.round(commissionAmountEur * 100)
    };
    await booking.save();

    res.status(201).json({
      success: true,
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Erreur session checkout trajet:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la session de paiement' });
  }
};

/**
 * @desc    Créer une session Stripe Checkout pour l'abonnement Premium
 * @route   POST /api/payments/create-checkout-session
 * @access  Privé
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    if (user.subscription?.isActive) {
      return res.status(400).json({ success: false, message: 'Déjà abonné' });
    }

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'entrelles://payment-success?session_id={CHECKOUT_SESSION_ID}&user_id=' + userId,
      cancel_url: 'entrelles://payment-cancel?session_id={CHECKOUT_SESSION_ID}&user_id=' + userId,
      allow_promotion_codes: true,
      metadata: { userId: userId.toString(), plan: 'premium' },
      subscription_data: { metadata: { userId: userId.toString(), plan: 'premium' } }
    });

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
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Erreur session checkout abonnement:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la session d\'abonnement' });
  }
};

/**
 * @desc    Récupérer le solde et les transactions du portefeuille (Connect)
 * @route   GET /api/payments/wallet-balance
 * @access  Privé
 */
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    const kycStatus = user.getKycStatus();
    let balanceData = { available: 0, pending: 0, currency: 'EUR' };
    let transactions = [];

    if (kycStatus.hasConnectAccount) {
      const stripeBalance = await stripe.balance.retrieve({ stripeAccount: kycStatus.connectAccountId });
      balanceData = {
        available: stripeBalance.available.reduce((sum, bal) => sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0),
        pending: stripeBalance.pending.reduce((sum, bal) => sum + (bal.currency === 'eur' ? bal.amount / 100 : 0), 0),
        currency: 'EUR'
      };

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
      data: { balance: balanceData, transactions }
    });

  } catch (error) {
    console.error('Erreur récupération portefeuille:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du solde' });
  }
};

/**
 * @desc    Récupérer l'historique des virements (Payouts)
 * @route   GET /api/payments/wallet-payouts
 * @access  Privé
 */
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
      description: `Virement vers le compte bancaire`
    }));

    res.json({ success: true, data: formattedPayouts });

  } catch (error) {
    console.error('Erreur récupération virements:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des virements' });
  }
};

module.exports = {
  createCheckoutSession,
  getSubscriptionStatus,
  createTripCheckoutSession,
  getDriverFinancialStatus,
  getWalletBalance,
  getWalletPayouts
};
