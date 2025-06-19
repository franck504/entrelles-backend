const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Booking = require('../models/Booking'); // ✅ AJOUT MANQUANT
const Trip = require('../models/Trip');


// @desc    Créer un abonnement mensuel 3€
// @route   POST /api/payments/create-subscription
// @access  Private
const createSubscription = async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.user.id;

    console.log('🔄 Creating subscription for user:', userId);
    console.log('💰 Price ID:', priceId);

    // 1. Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 2. Vérifier si déjà abonné
    if (user.subscription?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // 3. Créer ou récupérer le customer Stripe
    let customerId = user.stripe?.customerId;
    
    if (!customerId) {
      console.log('🆕 Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.displayName,
        metadata: {
          userId: userId.toString()
        }
      });
      customerId = customer.id;
      
      // Sauvegarder le customer ID
      await User.findByIdAndUpdate(userId, {
        'stripe.customerId': customerId
      });
      console.log('✅ Customer created:', customerId);
    }

    // 4. Créer l'abonnement
    console.log('💳 Creating subscription...');
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId.toString(),
        plan: 'premium'
      }
    });

    console.log('✅ Subscription created:', subscription.id);

    // 5. Mettre à jour l'utilisateur
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
      message: 'Subscription created successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        plan: {
          amount: 300, // 3€
          currency: 'eur',
          interval: 'month'
        }
      },
      clientSecret: subscription.latest_invoice.payment_intent?.client_secret,
      customer: {
        id: customerId,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Finaliser le setup d'abonnement après paiement
// @route   POST /api/payments/complete-subscription-setup
// @access  Private

// @desc    Finaliser le setup d'abonnement après paiement
// @route   POST /api/payments/complete-subscription-setup
// @access  Private
const completeSubscriptionSetup = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.id;

    console.log('🔄 Completing subscription setup:', subscriptionId);

    // 1. Récupérer la subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent']
    });

    // 2. Simuler la confirmation du PaymentIntent (pour les tests)
    const paymentIntent = subscription.latest_invoice.payment_intent;
    
    if (paymentIntent && paymentIntent.status === 'requires_payment_method') {
      // Confirmer avec une carte de test
      await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: 'pm_card_visa_debit' // Essayons celui-ci
      });
    }

    // 3. Récupérer la subscription mise à jour
    const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // 4. Mettre à jour l'utilisateur
    await User.findByIdAndUpdate(userId, {
      'subscription.status': updatedSubscription.status,
      'subscription.isActive': updatedSubscription.status === 'active',
      'subscription.currentPeriodStart': new Date(updatedSubscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(updatedSubscription.current_period_end * 1000)
    });

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        isActive: updatedSubscription.status === 'active'
      }
    });

  } catch (error) {
    console.error('❌ Complete subscription setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing subscription setup',
      error: error.message
    });
  }
};



// const completeSubscriptionSetup = async (req, res) => {
//   try {
//     const { subscriptionId, paymentMethodId } = req.body;
//     const userId = req.user.id;

//     console.log('🔄 Completing subscription setup:', subscriptionId);

//     // 1. Récupérer l'utilisateur
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // 2. Confirmer la subscription avec la méthode de paiement
//     const subscription = await stripe.subscriptions.update(subscriptionId, {
//       default_payment_method: paymentMethodId,
//     });

//     // 3. Récupérer le latest invoice pour confirmer le paiement
//     const invoice = await stripe.invoices.retrieve(subscription.latest_invoice, {
//       expand: ['payment_intent']
//     });

//     // 4. Confirmer le PaymentIntent si nécessaire
//     if (invoice.payment_intent && invoice.payment_intent.status === 'requires_confirmation') {
//       await stripe.paymentIntents.confirm(invoice.payment_intent.id);
//     }

//     // 5. Récupérer la subscription mise à jour
//     const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);

//     // 6. Mettre à jour l'utilisateur selon le statut final
//     const updateData = {
//       'subscription.stripeSubscriptionId': updatedSubscription.id,
//       'subscription.status': updatedSubscription.status,
//       'subscription.plan': 'premium',
//       'subscription.currentPeriodStart': new Date(updatedSubscription.current_period_start * 1000),
//       'subscription.currentPeriodEnd': new Date(updatedSubscription.current_period_end * 1000)
//     };

//     // Si active, marquer comme actif
//     if (updatedSubscription.status === 'active') {
//       updateData['subscription.isActive'] = true;
//     }

//     await User.findByIdAndUpdate(userId, updateData);

//     console.log('✅ Subscription setup completed:', updatedSubscription.status);

//     res.status(200).json({
//       success: true,
//       message: 'Subscription activated successfully',
//       subscription: {
//         id: updatedSubscription.id,
//         status: updatedSubscription.status,
//         current_period_start: updatedSubscription.current_period_start,
//         current_period_end: updatedSubscription.current_period_end,
//         plan: 'premium',
//         isActive: updatedSubscription.status === 'active'
//       }
//     });

//   } catch (error) {
//     console.error('❌ Complete subscription setup error:', error);
    
//     // Gestion d'erreurs spécifiques Stripe
//     if (error.type === 'StripeCardError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment failed',
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Error completing subscription setup',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// };

// @desc    Annuler un abonnement
// @route   POST /api/payments/cancel-subscription
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user || !user.subscription?.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Annuler l'abonnement Stripe
    const subscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true
      }
    );

    // Mettre à jour l'utilisateur
    await User.findByIdAndUpdate(userId, {
      'subscription.cancelAtPeriodEnd': true,
      'subscription.status': 'canceled'
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at period end',
      subscription: {
        id: subscription.id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end
      }
    });

  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error canceling subscription'
    });
  }
};

// @desc    Obtenir le statut de l'abonnement
// @route   GET /api/payments/subscription-status
// @access  Private
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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
    console.error('❌ Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting subscription status'
    });
  }
};

// @desc    Créer un PaymentIntent pour un trajet
// @route   POST /api/payments/create-trip-payment
// @access  Private
const createTripPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;
    
    console.log('💳 Creating trip payment for booking:', bookingId);

    // 1. Récupérer la réservation avec le trajet
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId)
      .populate('trip', 'distance departure arrival departureDateTime driver')
      .populate('passenger', 'email profile.displayName stripe.customerId')
      .populate('driver', 'profile.displayName email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
q
    // DEBUG COMPLET
    console.log('\n🔍 =========================');
    console.log('🔍 DEBUG PAIEMENT COMPLET');
    console.log('🔍 =========================');
    console.log('- Request user ID:', userId);
    console.log('- Request user type:', typeof userId);
    console.log('- Booking passenger ID:', booking.passenger._id.toString());
    console.log('- Booking passenger type:', typeof booking.passenger._id.toString());
    console.log('- Booking passenger email:', booking.passenger.email);
    console.log('- IDs match:', booking.passenger._id.toString() === userId);
    console.log('- Booking status:', booking.status);
    console.log('🔍 =========================\n');

    // ✅ CORRECTION 2 : Rétablir la vérification d'authentification
    if (booking.passenger._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only pay for your own bookings'
      });
    }

    // ✅ NOUVEAU CODE (accepte pending ET confirmed)
if (booking.status !== 'confirmed' && booking.status !== 'pending') {
  return res.status(400).json({
    success: false,
    message: `Booking status is ${booking.status}, cannot create payment`
  });
}

    // 4. Calculer le prix selon la formule 0.55€/place/km
    const distance = booking.trip.distance || 100; // Fallback si pas de distance
    const seats = booking.numberOfSeats;
    const pricePerSeatPerKm = 0.55; // 0.45 conductrice + 0.10 commission
    
    const totalAmountEur = distance * seats * pricePerSeatPerKm;
    const totalAmount = Math.round(totalAmountEur * 100); // Convertir en centimes
    
    const driverAmountEur = distance * seats * 0.45;
    const driverAmount = Math.round(driverAmountEur * 100);
    
    const commissionAmountEur = distance * seats * 0.10;
    const commissionAmount = Math.round(commissionAmountEur * 100);

    console.log(`💰 Calcul: ${distance}km × ${seats} places × 0.55€ = ${totalAmountEur}€`);
    console.log(`├── Conductrice: ${driverAmountEur}€`);
    console.log(`└── Commission: ${commissionAmountEur}€`);

    // 5. Créer ou récupérer le customer Stripe
    let customerId = booking.passenger.stripe?.customerId; // ✅ CORRECTION : Bon chemin

    if (!customerId) {
      console.log('👤 Creating Stripe customer for passenger...');
      const customer = await stripe.customers.create({
        email: booking.passenger.email,
        name: booking.passenger.profile.displayName,
        description: `Passagère Entrelles - ${booking.passenger.profile.displayName}`,
        metadata: {
          userId: booking.passenger._id.toString(),
          type: 'passenger',
          platform: 'entrelles'
        }
      });
      
      customerId = customer.id;
      console.log('✅ Customer created:', customerId, 'for', booking.passenger.email);
      
      // ✅ CORRECTION : Sauvegarder dans le bon chemin
      await User.findByIdAndUpdate(booking.passenger._id, {
        'stripe.customerId': customerId // ✅ Chemin correct
      });
      
      console.log('✅ Customer ID saved to user profile');
    } else {
      console.log('👤 Using existing customer:', customerId);
    }

    // ✅ DEBUG : Vérifier avant création PaymentIntent
    console.log('\n🔍 CUSTOMER DEBUG:');
    console.log('- Email:', booking.passenger.email);
    console.log('- Customer ID:', customerId);
    console.log('- Will be linked:', !!customerId);

    // 6. Créer PaymentIntent avec customer et sans redirections
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      customer: customerId, // ✅ IMPORTANT : Lier au customer
      description: `Trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
      receipt_email: booking.passenger.email, // ✅ NOUVEAU : Email pour reçu
      // ✅ CORRECTION PRINCIPALE : Désactiver redirections
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // ✅ CRITIQUE : Pas de redirections
      },
      metadata: {
        bookingId: bookingId.toString(),
        tripId: booking.trip._id.toString(),
        passengerId: booking.passenger._id.toString(),
        driverId: booking.driver._id.toString(),
        driverAmount: driverAmount.toString(),
        commissionAmount: commissionAmount.toString(),
        distance: distance.toString(),
        seats: seats.toString(),
        type: 'trip_payment',
        // ✅ NOUVEAU : Infos passagère pour dashboard
        passengerEmail: booking.passenger.email,
        passengerName: booking.passenger.profile.displayName
      }
    });

    // 7. Mettre à jour la réservation avec les infos de paiement
    booking.payment = {
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      currency: 'eur',
      status: 'processing',
      driverAmount: driverAmount,
      commissionAmount: commissionAmount,
      commission: {
        appFee: commissionAmount,
        driverAmount: driverAmount,
        processingFee: 0,
        totalAmount: totalAmount
      }
    };
    await booking.save();

    console.log('✅ PaymentIntent created:', paymentIntent.id);

    // 8. Réponse avec toutes les infos
    res.status(201).json({
      success: true,
      message: 'Trip payment created successfully',
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        currency: 'eur'
      },
      booking: {
        id: booking._id,
        status: booking.status,
        trip: {
          route: `${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
          date: booking.trip.departureDateTime,
          distance: distance
        }
      },
      breakdown: {
        totalEur: totalAmountEur,
        driverEur: driverAmountEur,
        commissionEur: commissionAmountEur,
        calculation: `${distance}km × ${seats} places × 0.55€/place/km`,
        details: {
          distance: distance,
          seats: seats,
          pricePerSeatPerKm: 0.55
        }
      }
    });

  } catch (error) {
    console.error('❌ Create trip payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating trip payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Confirmer un paiement de trajet
// @route   POST /api/payments/confirm-trip-payment
// @access  Private
const confirmTripPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    console.log('✅ Confirming trip payment:', paymentIntentId);

    // 1. Vérifier le PaymentIntent avec Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed',
        paymentStatus: paymentIntent.status
      });
    }

    // 2. Trouver la réservation via les métadonnées
    const bookingId = paymentIntent.metadata.bookingId;
    const booking = await Booking.findById(bookingId)
      .populate('trip', 'departure arrival departureDateTime distance')
      .populate('passenger', 'profile.displayName email')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // 3. Vérifier que l'utilisateur est autorisé
    if (booking.passenger._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this payment'
      });
    }

    // 4. Mettre à jour la réservation avec les infos de paiement
    booking.payment = {
      status: 'paid',
      stripePaymentIntentId: paymentIntentId,
      amount: paymentIntent.amount / 100, // Convertir centimes en euros
      currency: paymentIntent.currency,
      paidAt: new Date(),
      commission: {
        appAmount: parseInt(paymentIntent.metadata.commissionAmount) / 100,
        driverAmount: parseInt(paymentIntent.metadata.driverAmount) / 100
      },
      driverPayout: {
        amount: parseInt(paymentIntent.metadata.driverAmount) / 100,
        status: 'pending',
        scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Dans 7 jours
      }
    };

    // 5. Changer le statut de la réservation
    booking.status = 'paid';
    await booking.save();

    console.log('✅ Trip payment confirmed successfully');

    res.status(200).json({
      success: true,
      message: 'Trip payment confirmed successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        trip: {
          route: `${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
          date: booking.trip.departureDateTime,
          distance: booking.trip.distance
        },
        payment: {
          status: booking.payment.status,
          amount: booking.payment.amount,
          paidAt: booking.payment.paidAt,
          commission: booking.payment.commission,
          driverPayout: booking.payment.driverPayout
        }
      }
    });

  } catch (error) {
    console.error('❌ Confirm trip payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming trip payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ AJOUTER CETTE FONCTION MANQUANTE
// @desc Finaliser un paiement de trajet
// @route POST /api/payments/finalize-trip-payment
// @access Private
const finalizeTripPayment = async (req, res) => {
  try {
    const { bookingId, paymentMethodId = 'pm_card_visa' } = req.body;
    const userId = req.user.id;
    
    console.log('🎯 Finalizing trip payment for booking:', bookingId);

    // 1. Récupérer la réservation
    const booking = await Booking.findById(bookingId)
      .populate('trip', 'distance departure arrival departureDateTime')
      .populate('passenger', 'email profile.displayName')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // 2. Vérifier que l'utilisateur est la passagère
    if (booking.passenger._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the passenger can finalize payment'
      });
    }

    // 3. Vérifier qu'il y a un PaymentIntent à finaliser
    if (!booking.payment?.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'No payment intent found for this booking'
      });
    }

    console.log('💳 Finalizing PaymentIntent:', booking.payment.stripePaymentIntentId);

    // 4. Confirmer le PaymentIntent avec Stripe
    const paymentIntent = await stripe.paymentIntents.confirm(
      booking.payment.stripePaymentIntentId,
      {
        payment_method: paymentMethodId,
        return_url: 'https://entrelles.com/payment-success'
      }
    );

    console.log('✅ PaymentIntent status after confirmation:', paymentIntent.status);

    // 5. Mettre à jour selon le statut
    if (paymentIntent.status === 'succeeded') {
      // Paiement réussi
      booking.payment.status = 'succeeded';
      booking.payment.paidAt = new Date();
      booking.status = 'paid';

      // Programmer le virement conductrice (7 jours)
      booking.payment.driverPayout = {
        status: 'scheduled',
        amount: booking.payment.commission.driverAmount,
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      await booking.save();

      console.log('🎉 Payment finalized successfully!');

      res.status(200).json({
        success: true,
        message: 'Trip payment finalized successfully',
        booking: {
          id: booking._id,
          status: booking.status,
          trip: {
            route: `${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
            date: booking.trip.departureDateTime
          },
          payment: {
            status: booking.payment.status,
            amount: booking.payment.amount / 100,
            paidAt: booking.payment.paidAt,
            driverPayout: booking.payment.driverPayout
          }
        },
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        }
      });

    } else {
      // Paiement échoué
      booking.payment.status = 'failed';
      booking.payment.failedAt = new Date();
      await booking.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          last_payment_error: paymentIntent.last_payment_error
        }
      });
    }

  } catch (error) {
    console.error('❌ Finalize trip payment error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error finalizing trip payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};



const getPaymentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📊 Getting payment stats for user:', userId);

    // Stats passager
    const passengerStats = await Booking.aggregate([
      { $match: { passenger: userId } },
      {
        $group: {
          _id: '$payment.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$payment.amount' }
        }
      }
    ]);

    // Stats conductrice
    const driverStats = await Booking.aggregate([
      { $match: { driver: userId } },
      {
        $group: {
          _id: '$payment.status',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$payment.commission.driverAmount' }
        }
      }
    ]);

    // Virements en attente
    const pendingPayouts = await Booking.find({
      driver: userId,
      'payment.driverPayout.status': { $in: ['pending', 'scheduled'] }
    }).select('payment.driverPayout numberOfSeats totalPrice');

    // Formater les stats
    const formatStats = (stats) => {
      const result = {};
      stats.forEach(stat => {
        result[stat._id] = {
          count: stat.count,
          amount: stat.totalAmount || stat.totalEarnings || 0
        };
      });
      return result;
    };

    res.status(200).json({
      success: true,
      stats: {
        asPassenger: formatStats(passengerStats),
        asDriver: formatStats(driverStats),
        pendingPayouts: {
          count: pendingPayouts.length,
          totalAmount: pendingPayouts.reduce((sum, booking) => 
            sum + (booking.payment.driverPayout.amount || 0), 0
          )
        }
      }
    });

  } catch (error) {
    console.error('❌ Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment statistics'
    });
  }
};



// ✅ MAINTENANT L'EXPORT FONCTIONNE
module.exports = {
  createSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  createTripPayment,
  confirmTripPayment,
  finalizeTripPayment,
  getPaymentStats,
  completeSubscriptionSetup // ✅ Ajoutez cette ligne
};