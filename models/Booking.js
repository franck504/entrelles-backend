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
    enum: [
      'pending',
      'confirmed',
      'cancelled',
      'completed',
      'rejected',
      'refused',
      'paid',
      'expired',
    ],
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
  payment: {
    stripePaymentIntentId: String,
    stripeChargeId: String,
    stripeClientSecret: String,
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
      enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'paid'],
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
    commission: {
      appFee: { type: Number, default: 0 },
      driverAmount: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 }
    },
    driverPayout: {
      status: {
        type: String,
        enum: ['pending', 'scheduled', 'paid', 'failed', 'cancelled'],
        default: 'pending'
      },
      amount: Number,
      scheduledDate: Date,
      paidAt: Date,
      failureReason: String,
      stripeConnectAccountId: String,
      stripePayoutId: String,
      stripeTransferId: String,
      payoutDate: Date,
      transferDate: Date
    },
    refundId: String,
    refundAmount: { type: Number, default: 0 },
    paidAt: Date,
    failedAt: Date,
    refundedAt: Date,
    receiptUrl: String
  },
  paymentDeadline: Date,
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  }
}, {
  timestamps: true
});

// Indexation pour les paiements et recherches
bookingSchema.index({ trip: 1, passenger: 1 });
bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ passenger: 1, status: 1 });
bookingSchema.index({ status: 1, requestedAt: -1 });
bookingSchema.index({ 'payment.stripePaymentIntentId': 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ 'payment.driverPayout.status': 1 });

// Calcul de la commission et des montants
bookingSchema.methods.calculateCommission = function (distance) {
  const exactTotal = this.numberOfSeats * distance * 0.55;
  const exactDriverAmount = this.numberOfSeats * distance * 0.45;
  const exactAppFee = this.numberOfSeats * distance * 0.10;

  const totalAmount = Math.ceil(exactTotal * 100);
  const driverAmount = Math.ceil(exactDriverAmount * 100);
  const appFee = Math.ceil(exactAppFee * 100);
  const processingFee = Math.ceil(totalAmount * 0.029 + 25);

  return {
    appFee,
    driverAmount,
    processingFee,
    totalAmount
  };
};

// Intégration Stripe : Création de PaymentIntent
bookingSchema.methods.createPaymentIntent = async function (distance) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    await this.populate([
      { path: 'passenger', select: 'email profile.displayName stripe.customerId' },
      { path: 'trip', select: 'departure arrival distance' }
    ]);

    const commission = this.calculateCommission(distance);
    let customerId = this.passenger.stripe?.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: this.passenger.email,
        name: this.passenger.profile.displayName,
        metadata: {
          userId: this.passenger._id.toString(),
          type: 'passenger'
        }
      });
      customerId = customer.id;
      const User = require('./User');
      await User.findByIdAndUpdate(this.passenger._id, { 'stripe.customerId': customerId });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: commission.totalAmount,
      currency: 'eur',
      customer: customerId,
      receipt_email: this.passenger.email,
      description: `Trajet ${this.trip.departure.city} → ${this.trip.arrival.city}`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        bookingId: this._id.toString(),
        tripId: this.trip._id.toString(),
        passengerId: this.passenger._id.toString(),
        driverId: this.driver._id.toString()
      }
    });

    this.payment.stripePaymentIntentId = paymentIntent.id;
    this.payment.stripeClientSecret = paymentIntent.client_secret;
    this.payment.amount = commission.totalAmount;
    this.payment.commission = commission;
    this.payment.status = 'processing';

    await this.save();
    return paymentIntent;
  } catch (error) {
    console.error('Erreur lors de la création du PaymentIntent:', error);
    throw error;
  }
};

// Confirmation du paiement
bookingSchema.methods.confirmPayment = async function () {
  this.payment.status = 'succeeded';
  this.payment.paidAt = new Date();
  this.status = 'confirmed';
  this.confirmedAt = new Date();

  this.payment.driverPayout.status = 'scheduled';
  this.payment.driverPayout.amount = this.payment.commission.driverAmount;
  this.payment.driverPayout.scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await this.save();
  return this;
};

// Gestion des remboursements (80% passager, 100% conducteur/trajet annulé)
bookingSchema.methods.processRefund = async function (percent = 0.8) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    if (!this.payment.stripePaymentIntentId) {
      this.payment.status = 'refunded';
      this.payment.refundedAt = new Date();
      return this;
    }

    const totalAmount = this.payment.amount;
    const refundAmount = Math.floor(totalAmount * percent);
    const remaining = totalAmount - refundAmount;
    const driverFee = percent === 1.0 ? 0 : Math.floor(remaining * 0.5);

    const refund = await stripe.refunds.create({
      payment_intent: this.payment.stripePaymentIntentId,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: {
        bookingId: this._id.toString(),
        refundPercent: (percent * 100).toString()
      }
    });

    this.payment.refundId = refund.id;
    this.payment.refundedAt = new Date();
    this.payment.refundAmount = refundAmount;
    this.payment.status = 'refunded';

    if (this.payment.driverPayout.status !== 'paid') {
      if (percent === 1.0) {
        this.payment.driverPayout.amount = 0;
        this.payment.driverPayout.status = 'cancelled';
      } else {
        this.payment.driverPayout.amount = driverFee;
        this.payment.driverPayout.status = 'scheduled';
      }
    }

    await this.save();
    return refund;
  } catch (error) {
    console.error('Erreur lors du traitement du remboursement:', error);
    throw error;
  }
};

// Annulation d'une réservation
bookingSchema.methods.cancel = async function (userId, reason) {
  if (this.status === 'completed' || this.status === 'cancelled') {
    throw new Error('Action impossible sur cette réservation');
  }

  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;

  if (this.payment.status === 'succeeded') {
    const isFullRefund = reason && (reason.includes('Trajet annulé par la conductrice') || userId.toString() === this.driver.toString());
    let refundPercent = 1.0;

    if (!isFullRefund) {
      const Trip = mongoose.model('Trip');
      const trip = await Trip.findById(this.trip);
      if (trip) {
        const diffHours = (new Date(trip.departureDateTime) - new Date()) / (1000 * 60 * 60);
        refundPercent = diffHours < 24 ? 0.5 : 0.8;
      }
    }
    await this.processRefund(refundPercent);
  }

  await this.save();
  return this;
};

// Marquage comme terminé
bookingSchema.methods.complete = async function () {
  if (this.status !== 'confirmed') throw new Error('Seule une réservation confirmée peut être terminée');
  this.status = 'completed';
  this.completedAt = new Date();
  await this.save();
  return this;
};

// Ajout d'une évaluation
bookingSchema.methods.addReview = async function (rating, comment) {
  if (this.status !== 'completed' || (this.review && this.review.rating)) {
    throw new Error('Évaluation impossible');
  }

  this.review = { rating, comment: comment || '', reviewedAt: new Date() };
  await this.save();

  try {
    const User = mongoose.model('User');
    const driver = await User.findById(this.driver);
    if (driver) {
      const currentRating = driver.stats.rating || 0;
      const currentCount = driver.stats.ratingsCount || 0;
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await User.findByIdAndUpdate(this.driver, {
        $set: {
          'stats.rating': Math.round(newRating * 10) / 10,
          'stats.ratingsCount': newCount
        }
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note du conducteur:', error);
  }

  return this;
};

// Méthodes statiques pour la récupération des réservations
bookingSchema.statics.getBookingsByUser = function (userId, status = null) {
  let query = { $or: [{ passenger: userId }, { driver: userId }] };
  if (status) query.status = status;
  return this.find(query)
    .populate('trip', 'departure arrival departureDateTime pricePerSeat')
    .populate('passenger', 'profile.displayName profile.avatar')
    .populate('driver', 'profile.displayName profile.avatar')
    .sort({ requestedAt: -1 });
};

// Middleware pre-save pour initialiser le montant du paiement
bookingSchema.pre('save', function (next) {
  if (this.totalPrice && !this.payment.amount) {
    this.payment.amount = this.totalPrice * 100;
  }
  next();
});

// Exécution du virement planifié vers le conducteur
bookingSchema.methods.executeScheduledPayout = async function () {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    const Trip = require('./Trip');
    const trip = await Trip.findById(this.trip).populate('driver');
    const driver = trip.driver;

    if (!driver.kyc?.stripeConnectAccountId || !driver.kyc?.canReceivePayments) {
      throw new Error('Le conducteur n\'est pas configuré pour recevoir des paiements');
    }

    const transfer = await stripe.transfers.create({
      amount: this.payment.driverPayout.amount,
      currency: 'eur',
      destination: driver.kyc.stripeConnectAccountId,
      description: `Paiement trajet ${trip.departure.city} → ${trip.arrival.city}`,
      metadata: { bookingId: this._id.toString(), type: 'driver_payout' }
    });

    this.payment.driverPayout.stripeConnectAccountId = driver.kyc.stripeConnectAccountId;
    this.payment.driverPayout.stripeTransferId = transfer.id;
    this.payment.driverPayout.status = 'paid';
    this.payment.driverPayout.paidAt = new Date();

    await this.save();
    return transfer;
  } catch (error) {
    this.payment.driverPayout.status = 'failed';
    this.payment.driverPayout.failureReason = error.message;
    await this.save();
    throw error;
  }
};

module.exports = mongoose.model('Booking', bookingSchema);