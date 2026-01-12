const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver is required']
  },
  departure: {
    city: {
      type: String,
      required: [true, 'Departure city is required'],
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    postalCode: String
  },
  arrival: {
    city: {
      type: String,
      required: [true, 'Arrival city is required'],
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    postalCode: String
  },
  departureDateTime: {
    type: Date,
    required: [true, 'Departure date and time is required']
    // ✅ VALIDATION RETIRÉE - sera gérée côté controller si nécessaire
  },
  estimatedArrivalDateTime: {
    type: Date
  },
  estimatedDuration: {
    type: Number,
    default: 120 // ✅ DEFAULT au lieu de validation
  },
  availableSeats: {
    type: Number,
    default: 1,
    min: 0, // allow 0 seats when trip is full
    max: 7
  },
  totalSeats: {
    type: Number,
    default: 1,   // modified 16 juillet 16:50
    min: 1,
    max: 8
  },
  pricePerSeat: {
    type: Number,
    //default: 20 // ✅ DEFAULT au lieu de validation stricte
  },
  distance: {
    type: Number,
    default: 3 // ✅ DEFAULT au lieu de validation stricte
  },
  vehicle: {
    brand: String,
    model: String,
    color: String,
    year: {
      type: Number,
      min: [1990, 'Vehicle year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Vehicle year cannot be in the future']
    },
    licensePlate: String,
    fuelType: {
      type: String,
      enum: ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL'],
      default: 'Essence'
    }
  },
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
      type: Number,
      min: [0, 'Max detour cannot be negative'],
      max: [50, 'Max detour cannot exceed 50 km'],
      default: 10
    },
    paymentDeadlineHours: {
      type: Number,
      min: [1, 'Deadline must be at least 1 hour'],
      max: [72, 'Deadline cannot exceed 72 hours'],
      default: 24 // Par défaut, la passagère doit payer 24h avant le trajet
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [300, 'Notes cannot exceed 300 characters']
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    daysOfWeek: [Number],
    endDate: Date
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    viewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    bookingRequests: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// ✅ MIDDLEWARE PRE-SAVE pour génération automatique
tripSchema.pre('save', function (next) {
  // Génération automatique des données manquantes
  if (!this.estimatedArrivalDateTime && this.departureDateTime && this.estimatedDuration) {
    this.estimatedArrivalDateTime = new Date(
      this.departureDateTime.getTime() + (this.estimatedDuration * 60 * 1000)
    );
  }
  next();
});

// Méthode pour vérifier si un trajet peut être réservé par un utilisateur
tripSchema.methods.canBeBookedBy = function (userId) {
  // Vérifier que le trajet est actif
  if (this.status !== 'active') {
    return false;
  }

  // Vérifier que ce n'est pas le conducteur qui essaie de réserver son propre trajet
  if (this.driver.toString() === userId.toString()) {
    return false;
  }

  // Vérifier que le trajet n'est pas dans le passé
  if (this.departureDateTime <= new Date()) {
    return false;
  }

  // Vérifier qu'il y a des places disponibles
  if (this.availableSeats <= 0) {
    return false;
  }

  return true;
};

// Index pour les recherches
tripSchema.index({ 'departure.city': 1, 'arrival.city': 1, departureDateTime: 1 });
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ departureDateTime: 1, status: 1 });

module.exports = mongoose.model('Trip', tripSchema);