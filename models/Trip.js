const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Conductrice requise']
  },
  departure: {
    city: {
      type: String,
      required: [true, 'Ville de départ requise'],
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
      required: [true, 'Ville d\'arrivée requise'],
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
    required: [true, 'Date et heure de départ requises']
  },
  estimatedArrivalDateTime: {
    type: Date
  },
  estimatedDuration: {
    type: Number,
    default: 120
  },
  availableSeats: {
    type: Number,
    default: 1,
    min: 0,
    max: 7
  },
  totalSeats: {
    type: Number,
    default: 1,
    min: 1,
    max: 8
  },
  pricePerSeat: {
    type: Number
  },
  distance: {
    type: Number,
    default: 0
  },
  vehicle: {
    brand: String,
    model: String,
    color: String,
    year: {
      type: Number,
      min: [1990, 'L\'année du véhicule doit être 1990 ou plus'],
      max: [new Date().getFullYear() + 1, 'L\'année du véhicule ne peut pas être dans le futur']
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
      min: [0, 'Le détour maximum ne peut pas être négatif'],
      max: [50, 'Le détour maximum ne peut pas dépasser 50 km'],
      default: 10
    },
    paymentDeadlineHours: {
      type: Number,
      min: [1, 'Le délai doit être d\'au moins 1 heure'],
      max: [72, 'Le délai ne peut pas dépasser 72 heures'],
      default: 24
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [300, 'Les notes ne peuvent pas dépasser 300 caractères']
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

// Calcul automatique de l'heure d'arrivée estimée
tripSchema.pre('save', function (next) {
  if (!this.estimatedArrivalDateTime && this.departureDateTime && this.estimatedDuration) {
    this.estimatedArrivalDateTime = new Date(
      this.departureDateTime.getTime() + (this.estimatedDuration * 60 * 1000)
    );
  }
  next();
});

// Vérification de la disponibilité du trajet
tripSchema.methods.canBeBookedBy = function (userId) {
  if (this.status !== 'active') return false;
  if (this.driver.toString() === userId.toString()) return false;
  if (this.departureDateTime <= new Date()) return false;
  if (this.availableSeats <= 0) return false;
  return true;
};

// Indexation pour les recherches
tripSchema.index({ 'departure.city': 1, 'arrival.city': 1, departureDateTime: 1 });
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ departureDateTime: 1, status: 1 });

module.exports = mongoose.model('Trip', tripSchema);