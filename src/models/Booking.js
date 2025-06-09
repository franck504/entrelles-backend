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

// Index pour les performances
bookingSchema.index({ trip: 1, passenger: 1 });
bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ passenger: 1, status: 1 });
bookingSchema.index({ status: 1, requestedAt: -1 });

// Méthodes d'instance
bookingSchema.methods.cancel = async function(userId, reason) {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel a completed booking');
  }
  
  if (this.status === 'cancelled') {
    throw new Error('Booking is already cancelled');
  }

  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  
  await this.save();
  return this;
};

bookingSchema.methods.complete = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be completed');
  }

  this.status = 'completed';
  this.completedAt = new Date();
  
  await this.save();
  return this;
};

// ✅ NOUVELLE VERSION: Méthode addReview complètement réécrite
bookingSchema.methods.addReview = async function(rating, comment) {
  console.log('🔍 Starting addReview method...');
  
  if (this.status !== 'completed') {
    throw new Error('Can only review completed trips');
  }

  if (this.review && this.review.rating) {
    throw new Error('Review already exists for this booking');
  }

  // Ajouter la review à la réservation
  this.review = {
    rating: rating,
    comment: comment || '',
    reviewedAt: new Date()
  };

  console.log('✅ Review added to booking');

  // Sauvegarder la réservation avec la review
  await this.save();
  console.log('✅ Booking saved with review');

  // ✅ CORRECTION: Mettre à jour les stats du conducteur de façon sécurisée
  try {
    console.log('🔍 Updating driver rating...');
    
    // Importer le modèle User de façon sécurisée
    const User = mongoose.model('User');
    
    // Récupérer le conducteur
    const driver = await User.findById(this.driver);
    if (!driver) {
      console.log('⚠️ Driver not found, skipping rating update');
      return this;
    }

    console.log('✅ Driver found:', driver.profile.displayName);

    // Calculer la nouvelle moyenne des notes
    const currentRating = driver.stats.rating || 0;
    const currentCount = driver.stats.ratingsCount || 0;
    
    const newCount = currentCount + 1;
    const newRating = ((currentRating * currentCount) + rating) / newCount;
    
    // Mettre à jour les stats directement
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
    // Ne pas faire échouer la review si la mise à jour du rating échoue
  }

  console.log('✅ addReview method completed successfully');
  return this;
};

// Méthodes statiques
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

// Middleware pre-save
bookingSchema.pre('save', function(next) {
  // Validation métier
  if (this.numberOfSeats <= 0) {
    next(new Error('Number of seats must be positive'));
  }
  
  if (this.totalPrice < 0) {
    next(new Error('Total price cannot be negative'));
  }
  
  next();
});

// Middleware post-save pour les notifications
bookingSchema.post('save', function(doc) {
  // TODO: Envoyer des notifications selon le statut
  console.log(`📧 Notification: Booking ${doc._id} status changed to ${doc.status}`);
});

module.exports = mongoose.model('Booking', bookingSchema);