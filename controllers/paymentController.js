const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// ✅ ABONNEMENT EN 1 COUP - SEULE FONCTION NÉCESSAIRE
const createAndActivateSubscription = async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;
    
    console.log('🚀 Creating subscription for user:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.subscription?.isActive) {
      return res.status(400).json({ success: false, message: 'Already subscribed' });
    }

    // ✅ SOLUTION PERMANENTE - Auto-recovery customer
    let customerId = user.stripe?.customerId;
    
    // Vérifier si le customer existe dans Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log('✅ Customer existant trouvé:', customerId);
      } catch (error) {
        if (error.code === 'resource_missing') {
          console.log('❌ Customer inexistant dans Stripe, recréation automatique...');
          customerId = null; // Forcer la recréation
          
          // Nettoyer l'ancien customerId en base
          await User.findByIdAndUpdate(userId, { 
            $unset: { 'stripe.customerId': 1 } 
          });
        } else {
          throw error; // Autre erreur Stripe
        }
      }
    }

    // Créer nouveau customer si nécessaire
    if (!customerId) {
      console.log('🆕 Création nouveau customer Stripe...');
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.displayName,
        metadata: { 
          userId: userId.toString(),
          createdAt: new Date().toISOString()
        }
      });
      
      customerId = customer.id;
      
      // Sauvegarder le nouveau customerId
      await User.findByIdAndUpdate(userId, { 
        'stripe.customerId': customerId 
      });
      
      console.log('✅ Nouveau customer créé:', customerId);
    }

    // Créer payment method
    const paymentMethodId = 'pm_card_visa';
    
    await stripe.paymentMethods.attach(paymentMethodId, { 
      customer: customerId 
    });
    
    await stripe.customers.update(customerId, {
      invoice_settings: { 
        default_payment_method: paymentMethodId 
      }
    });

    // Créer abonnement
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { 
        userId: userId.toString(), 
        plan: 'premium' 
      }
    });

    // Sauvegarder abonnement
    await User.findByIdAndUpdate(userId, {
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.status': subscription.status,
      'subscription.plan': 'premium',
      'subscription.isActive': subscription.status === 'active',
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
    });

    res.status(201).json({
      success: true,
      message: '🎉 Bienvenue dans Entrelles Premium !',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        isActive: subscription.status === 'active'
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

// ✅ STATUT ABONNEMENT - SIMPLE
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

// ✅ PAIEMENT TRAJET - FONCTION PRINCIPALE
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

    // Créer payment method test et confirmer
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: { token: 'tok_visa' }
    });

    const paymentIntent = await stripe.paymentIntents.confirm(
      booking.payment.stripePaymentIntentId,
      { payment_method: paymentMethod.id }
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

// @desc Obtenir le statut financier complet du conducteur
// @route GET /api/payments/driver/financial-status
// @access Private
const getDriverFinancialStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // 1. Statut KYC
    const kycStatus = user.getKycStatus();
    let balance = null;
    let payouts = null;

    // 2. Balance si compte vérifié
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

        // 3. Derniers virements
        const stripePayouts = await stripe.payouts.list(
          { limit: 10 },
          { stripeAccount: kycStatus.connectAccountId }
        );

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

// ✅ EXPORT AVEC NOUVELLE FONCTION
module.exports = {
  createAndActivateSubscription,
  getSubscriptionStatus,
  createTripPayment,
  finalizeTripPayment,
  getDriverFinancialStatus
};
