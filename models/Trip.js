const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  // Informations de base
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Itinéraire
  departure: {
    city: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    postalCode: String
  },
  
  arrival: {
    city: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    postalCode: String
  },
  
  // Étapes intermédiaires (optionnel)
  waypoints: [{
    city: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  }],
  
  // Horaires
  departureDateTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Departure date must be in the future'
    }
  },
  
  estimatedArrivalDateTime: {
    type: Date,
    required: false, // ✅ Changé de true à false
    validate: {
      validator: function(value) {
        if (value && this.departureDateTime) {
          return value > this.departureDateTime;
        }
        return true;
      },
      message: 'Estimated arrival must be after departure'
    }
  },
  
  // Capacité et tarif
  availableSeats: {
    type: Number,
    required: true,
    min: 1,
    max: 7,
    default: 3
  },
  
  totalSeats: {
    type: Number,
    required: true,
    min: 1,
    max: 7,
    default: 3
  },
  
  pricePerSeat: {
    type: Number,
    required: true,
    min: 0,
    max: 200 // Prix maximum par siège
  },
  
  // Informations du véhicule
  vehicle: {
    brand: String,
    model: String,
    color: String,
    licensePlate: String,
    year: Number
  },
  
  // Préférences et règles
  preferences: {
    allowSmoking: {
      type: Boolean,
      default: false
    },
    allowPets: {
      type: Boolean,
      default: false
    },
    allowFood: {
      type: Boolean,
      default: true
    },
    musicPreference: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'medium'
    },
    chatLevel: {
      type: String,
      enum: ['quiet', 'normal', 'talkative'],
      default: 'normal'
    },
    maxDetour: {
      type: Number, // en km
      default: 10
    }
  },
  
  // Description et notes
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  notes: {
    type: String,
    maxlength: 500,
    trim: true
  },
  
  // Statut du trajet
  status: {
    type: String,
    enum: ['active', 'full', 'completed', 'cancelled'],
    default: 'active'
  },
  
  // Récurrence (pour trajets réguliers)
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: function() { return this.isRecurring; }
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6 // 0 = Dimanche, 6 = Samedi
    }],
    endDate: Date
  },
  
  // Métadonnées
  distance: {
    type: Number, // en km
    required: true
  },
  
  estimatedDuration: {
    type: Number, // en minutes
    required: true
  },
  
  // Statistiques
  stats: {
    views: {
      type: Number,
      default: 0
    },
    bookingRequests: {
      type: Number,
      default: 0
    }
  },
  
  // Modération
  isVerified: {
    type: Boolean,
    default: false
  },
  
  moderationFlags: [{
    reason: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les recherches géographiques
tripSchema.index({ 
  'departure.coordinates': '2dsphere',
  'arrival.coordinates': '2dsphere'
});

// Index pour les recherches par date
tripSchema.index({ departureDateTime: 1 });

// Index pour les recherches par ville
tripSchema.index({ 
  'departure.city': 'text',
  'arrival.city': 'text'
});

// Index composé pour les recherches courantes
tripSchema.index({
  'departure.city': 1,
  'arrival.city': 1,
  departureDateTime: 1,
  status: 1
});

// Virtuals
tripSchema.virtual('bookedSeats').get(function() {
  return this.totalSeats - this.availableSeats;
});

tripSchema.virtual('isFull').get(function() {
  return this.availableSeats === 0;
});

tripSchema.virtual('isUpcoming').get(function() {
  return this.departureDateTime > new Date();
});

tripSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'trip'
});

// Méthodes d'instance
tripSchema.methods.canBeBookedBy = function(userId) {
  // Vérifier si l'utilisateur peut réserver ce trajet
  return this.driver.toString() !== userId.toString() && 
         this.availableSeats > 0 && 
         this.status === 'active' &&
         this.departureDateTime > new Date();
};

tripSchema.methods.updateAvailableSeats = async function() {
  const Booking = mongoose.model('Booking');
  const confirmedBookings = await Booking.countDocuments({
    trip: this._id,
    status: 'confirmed'
  });
  
  this.availableSeats = this.totalSeats - confirmedBookings;
  
  if (this.availableSeats === 0) {
    this.status = 'full';
  } else if (this.status === 'full' && this.availableSeats > 0) {
    this.status = 'active';
  }
  
  return this.save();
};

// Méthodes statiques
tripSchema.statics.searchTrips = function(searchParams) {
  const {
    departureCity,
    arrivalCity,
    departureDate,
    passengers = 1,
    maxPrice,
    departureRadius = 50, // km
    arrivalRadius = 50,
    preferences = {}
  } = searchParams;

  let query = {
    status: 'active',
    availableSeats: { $gte: passengers },
    departureDateTime: {
      $gte: new Date(departureDate),
      $lt: new Date(new Date(departureDate).getTime() + 24 * 60 * 60 * 1000)
    }
  };

  // Filtres par ville
  if (departureCity) {
    query['departure.city'] = new RegExp(departureCity, 'i');
  }
  
  if (arrivalCity) {
    query['arrival.city'] = new RegExp(arrivalCity, 'i');
  }

  // Filtre par prix
  if (maxPrice) {
    query.pricePerSeat = { $lte: maxPrice };
  }

  // Filtres par préférences
  if (preferences.allowSmoking !== undefined) {
    query['preferences.allowSmoking'] = preferences.allowSmoking;
  }
  
  if (preferences.allowPets !== undefined) {
    query['preferences.allowPets'] = preferences.allowPets;
  }

  return this.find(query)
    .populate('driver', 'profile.displayName profile.avatar profile.bio stats.rating stats.tripsCompleted createdAt')
    .sort({ departureDateTime: 1 });
};

// Middleware pre-save
tripSchema.pre('save', function(next) {
  // Si estimatedArrivalDateTime n'est pas fourni, le calculer
  if (!this.estimatedArrivalDateTime && this.departureDateTime && this.estimatedDuration) {
    this.estimatedArrivalDateTime = new Date(
      this.departureDateTime.getTime() + (this.estimatedDuration * 60 * 1000)
    );
  }
  next();
});

// Middleware pre-remove
tripSchema.pre('remove', async function(next) {
  // Supprimer toutes les réservations associées
  const Booking = mongoose.model('Booking');
  await Booking.deleteMany({ trip: this._id });
  next();
});

module.exports = mongoose.model('Trip', tripSchema);