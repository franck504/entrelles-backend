const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  numberOfSeats: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 500
  },
  customPickup: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  customDropoff: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  cancelledAt: Date,
  completedAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    reviewedAt: Date
  },

  // ✅ SECTION PAYMENT COMPLÈTE AVEC 'paid' AJOUTÉ
  payment: {
    stripePaymentIntentId: String,
    stripeChargeId: String,
    stripeClientSecret: String, // ✅ AJOUTÉ
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'eur'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'paid'], // ✅ AJOUT 'paid'
      default: 'pending'
    },
    driverAmount: {
      type: Number,
      default: 0
    },
    commissionAmount: {
      type: Number,
      default: 0
    },
    // ✅ PROPRIÉTÉS MANQUANTES AJOUTÉES :
    commission: {
      appFee: { type: Number, default: 0 },
      driverAmount: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 }
    },
    driverPayout: {
      status: ['pending', 'scheduled', 'paid', 'failed'],
      amount: Number,
      scheduledDate: Date,
      paidAt: Date,
      failureReason: String,
      // ✅ NOUVEAUX CHAMPS STRIPE CONNECT:
      stripeConnectAccountId: String,  // Compte destination
      stripePayoutId: String,          // ID du virement
      stripeTransferId: String,        // ID du transfert
      payoutDate: Date,                // Date réelle du virement
      transferDate: Date               // Date réelle du transfert
    },
    refundId: String,
    refundAmount: { type: Number, default: 0 },
    paidAt: Date,
    failedAt: Date,
    refundedAt: Date,
    receiptUrl: String
  },

  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  }
}, 
{
  timestamps: true
});

// ✅ NOUVEAUX INDEX POUR PAIEMENTS
bookingSchema.index({ trip: 1, passenger: 1 });
bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ passenger: 1, status: 1 });
bookingSchema.index({ status: 1, requestedAt: -1 });
bookingSchema.index({ 'payment.stripePaymentIntentId': 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ 'payment.driverPayout.status': 1 });

// ✅ NOUVELLES MÉTHODES PAIEMENT

// Calculer la commission basée sur la distance
bookingSchema.methods.calculateCommission = function(distance) {
  console.log('🔍 Calculating commission for distance:', distance, 'km, seats:', this.numberOfSeats);
  
  // Calculs exacts en euros
  const exactTotal = this.numberOfSeats * distance * 0.55;
  const exactDriverAmount = this.numberOfSeats * distance * 0.45;
  const exactAppFee = this.numberOfSeats * distance * 0.10;
  
  // Arrondir VERS LE HAUT en centimes (aucune perte pour les parties prenantes)
  const totalAmount = Math.ceil(exactTotal * 100);
  const driverAmount = Math.ceil(exactDriverAmount * 100);
  const appFee = Math.ceil(exactAppFee * 100);
  const processingFee = Math.ceil(totalAmount * 0.029 + 25); // 2.9% + 0.25€
  
  console.log('💰 Commission calculated (NO LOSS):', {
    exactCalculations: {
      total: exactTotal.toFixed(2) + '€',
      driver: exactDriverAmount.toFixed(2) + '€',
      commission: exactAppFee.toFixed(2) + '€'
    },
    finalAmounts: {
      totalAmount: totalAmount / 100 + '€',
      driverAmount: driverAmount / 100 + '€',
      appFee: appFee / 100 + '€',
      processingFee: processingFee / 100 + '€'
    },
    stripeAmount: totalAmount + ' centimes (valid integer)'
  });
  
  return {
    appFee,
    driverAmount,
    processingFee,
    totalAmount
  };
};

// Créer un PaymentIntent Stripe
bookingSchema.methods.createPaymentIntent = async function(distance) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    console.log('🔍 Creating PaymentIntent for booking:', this._id);
    
    // ✅ NOUVEAU : Populer les données utilisateur
    await this.populate([
      { path: 'passenger', select: 'email profile.displayName stripe.customerId' },
      { path: 'trip', select: 'departure arrival distance' }
    ]);
    
    const commission = this.calculateCommission(distance);
    
    // ✅ NOUVEAU : Gérer le customer Stripe
    let customerId = this.passenger.stripe?.customerId;
    
    if (!customerId) {
      console.log('👤 Creating customer for passenger:', this.passenger.email);
      const customer = await stripe.customers.create({
        email: this.passenger.email,
        name: this.passenger.profile.displayName,
        metadata: {
          userId: this.passenger._id.toString(),
          type: 'passenger'
        }
      });
      
      customerId = customer.id;
      
      // Sauvegarder le customer ID
      const User = require('./User');
      await User.findByIdAndUpdate(this.passenger._id, {
        'stripe.customerId': customerId
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: commission.totalAmount,
      currency: 'eur',
      customer: customerId, // ✅ NOUVEAU : Lier au customer
      receipt_email: this.passenger.email, // ✅ NOUVEAU : Email pour reçu
      description: `Trajet ${this.trip.departure.city} → ${this.trip.arrival.city}`,
      // ✅ NOUVEAU : Désactiver redirections
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        bookingId: this._id.toString(),
        tripId: this.trip._id.toString(),
        passengerId: this.passenger._id.toString(),
        driverId: this.driver._id.toString(),
        passengerEmail: this.passenger.email,
        passengerName: this.passenger.profile.displayName
      }
    });

    // Sauvegarder les infos de paiement
    this.payment.stripePaymentIntentId = paymentIntent.id;
    this.payment.stripeClientSecret = paymentIntent.client_secret;
    this.payment.amount = commission.totalAmount;
    this.payment.commission = commission;
    this.payment.status = 'processing';
    
    await this.save();
    
    console.log('✅ PaymentIntent created with customer:', customerId);
    return paymentIntent;
    
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    throw error;
  }
};

// Confirmer le paiement après succès
bookingSchema.methods.confirmPayment = async function() {
  console.log('🔍 Confirming payment for booking:', this._id);
  
  this.payment.status = 'succeeded';
  this.payment.paidAt = new Date();
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  
  // Programmer le virement conductrice (7 jours après paiement)
  this.payment.driverPayout.status = 'scheduled';
  this.payment.driverPayout.amount = this.payment.commission.driverAmount;
  this.payment.driverPayout.scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await this.save();
  
  console.log('✅ Payment confirmed, driver payout scheduled for:', this.payment.driverPayout.scheduledDate);
  return this;
};

// Traiter un remboursement
bookingSchema.methods.processRefund = async function() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    console.log('🔍 Processing refund for booking:', this._id);
    
    if (!this.payment.stripePaymentIntentId) {
      throw new Error('No payment to refund');
    }
    
    const refund = await stripe.refunds.create({
      payment_intent: this.payment.stripePaymentIntentId,
      amount: this.payment.amount,
      reason: 'requested_by_customer',
      metadata: {
        bookingId: this._id.toString(),
        type: 'trip_cancellation'
      }
    });
    
    this.payment.refundId = refund.id;
    this.payment.refundedAt = new Date();
    this.payment.refundAmount = refund.amount;
    this.payment.status = 'canceled';
    
    // Annuler le virement conductrice si pas encore effectué
    if (this.payment.driverPayout.status !== 'paid') {
      this.payment.driverPayout.status = 'failed';
      this.payment.driverPayout.failureReason = 'Booking cancelled and refunded';
    }
    
    await this.save();
    
    console.log('✅ Refund processed successfully:', refund.id);
    return refund;
    
  } catch (error) {
    console.error('❌ Error processing refund:', error);
    throw error;
  }
};

// ✅ MÉTHODES EXISTANTES MODIFIÉES

// Annuler une réservation (avec gestion remboursement)
bookingSchema.methods.cancel = async function(userId, reason) {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel a completed booking');
  }
  
  if (this.status === 'cancelled') {
    throw new Error('Booking is already cancelled');
  }

  console.log('🔍 Cancelling booking:', this._id, 'by user:', userId);

  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  
  // ✅ NOUVEAU : Gérer remboursement automatique si payé
  if (this.payment.status === 'succeeded') {
    console.log('💰 Processing automatic refund...');
    await this.processRefund();
  }
  
  await this.save();
  console.log('✅ Booking cancelled successfully');
  return this;
};

// Marquer comme terminé
bookingSchema.methods.complete = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be completed');
  }

  this.status = 'completed';
  this.completedAt = new Date();
  
  await this.save();
  return this;
};

// Ajouter une évaluation (CONSERVÉE)
bookingSchema.methods.addReview = async function(rating, comment) {
  console.log('🔍 Starting addReview method...');
  
  if (this.status !== 'completed') {
    throw new Error('Can only review completed trips');
  }

  if (this.review && this.review.rating) {
    throw new Error('Review already exists for this booking');
  }

  this.review = {
    rating: rating,
    comment: comment || '',
    reviewedAt: new Date()
  };

  console.log('✅ Review added to booking');
  await this.save();
  console.log('✅ Booking saved with review');

  try {
    console.log('🔍 Updating driver rating...');
    const User = mongoose.model('User');
    const driver = await User.findById(this.driver);
    
    if (!driver) {
      console.log('⚠️ Driver not found, skipping rating update');
      return this;
    }

    console.log('✅ Driver found:', driver.profile.displayName);
    const currentRating = driver.stats.rating || 0;
    const currentCount = driver.stats.ratingsCount || 0;
    const newCount = currentCount + 1;
    const newRating = ((currentRating * currentCount) + rating) / newCount;
    
    const updateResult = await User.findByIdAndUpdate(
      this.driver,
      {
        $set: {
          'stats.rating': Math.round(newRating * 10) / 10,
          'stats.ratingsCount': newCount
        }
      },
      { new: true }
    );

    if (updateResult) {
      console.log(`✅ Driver rating updated: ${updateResult.stats.rating} (${newCount} reviews)`);
    } else {
      console.log('⚠️ Failed to update driver rating');
    }
    
  } catch (error) {
    console.error('❌ Error updating driver rating:', error.message);
  }

  console.log('✅ addReview method completed successfully');
  return this;
};

// ✅ MÉTHODES STATIQUES CONSERVÉES

bookingSchema.statics.getBookingsByUser = function(userId, status = null) {
  let query = {
    $or: [
      { passenger: userId },
      { driver: userId }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('trip', 'departure arrival departureDateTime pricePerSeat')
    .populate('passenger', 'profile.displayName profile.avatar')
    .populate('driver', 'profile.displayName profile.avatar')
    .sort({ requestedAt: -1 });
};

bookingSchema.statics.getUpcomingBookings = function(userId) {
  const now = new Date();
  
  return this.find({
    $or: [
      { passenger: userId },
      { driver: userId }
    ],
    status: { $in: ['confirmed', 'pending'] }
  })
  .populate({
    path: 'trip',
    match: { departureDateTime: { $gte: now } },
    select: 'departure arrival departureDateTime pricePerSeat status'
  })
  .populate('passenger', 'profile.displayName profile.avatar')
  .populate('driver', 'profile.displayName profile.avatar')
  .sort({ 'trip.departureDateTime': 1 });
};

// ✅ MIDDLEWARE PRE-SAVE ÉTENDU

bookingSchema.pre('save', function(next) {
  // Validations existantes
  if (this.numberOfSeats <= 0) {
    next(new Error('Number of seats must be positive'));
  }
  
  if (this.totalPrice < 0) {
    next(new Error('Total price cannot be negative'));
  }
  
  // ✅ NOUVEAU : Initialiser paiement si pas défini
  if (!this.payment.amount && this.totalPrice) {
    this.payment.amount = this.totalPrice * 100; // Convertir en centimes
  }
  
  next();
});

// Middleware post-save (CONSERVÉ)
bookingSchema.post('save', function(doc) {
  console.log(`📧 Notification: Booking ${doc._id} status changed to ${doc.status}`);
});

// ✅ NOUVELLE MÉTHODE:
bookingSchema.methods.executeScheduledPayout = async function() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    // 1. Récupérer le compte Connect du driver
    const Trip = require('./Trip');
    const User = require('./User');
    
    const trip = await Trip.findById(this.trip).populate('driver');
    const driver = trip.driver;
    
    if (!driver.kyc?.stripeConnectAccountId) {
      throw new Error('Driver has no Connect account');
    }
    
    if (!driver.kyc?.canReceivePayments) {
      throw new Error('Driver cannot receive payments');
    }
    
    // 2. Créer le transfert vers le compte Connect
    const transfer = await stripe.transfers.create({
      amount: this.payment.driverPayout.amount,
      currency: 'eur',
      destination: driver.kyc.stripeConnectAccountId,
      description: `Paiement trajet ${trip.departure.city} → ${trip.arrival.city}`,
      metadata: {
        bookingId: this._id.toString(),
        tripId: this.trip.toString(),
        driverId: driver._id.toString(),
        type: 'driver_payout'
      }
    });
    
    // 3. Mettre à jour le booking
    this.payment.driverPayout.stripeConnectAccountId = driver.kyc.stripeConnectAccountId;
    this.payment.driverPayout.stripeTransferId = transfer.id;
    this.payment.driverPayout.status = 'paid';
    this.payment.driverPayout.paidAt = new Date();
    this.payment.driverPayout.transferDate = new Date();
    
    await this.save();
    
    console.log('✅ Driver payout executed:', transfer.id);
    return transfer;
    
  } catch (error) {
    // Marquer comme échoué
    this.payment.driverPayout.status = 'failed';
    this.payment.driverPayout.failureReason = error.message;
    await this.save();
    
    console.error('❌ Driver payout failed:', error);
    throw error;
  }
};

module.exports = mongoose.model('Booking', bookingSchema);