const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Créer un nouveau trajet
// @route   POST /api/trips
// @access  Private
const createTrip = async (req, res) => {
  try {
    const {
      departure,
      arrival,
      departureDateTime,
      estimatedDuration,
      availableSeats,
      pricePerSeat,
      vehicle,
      preferences,
      description,
      notes,
      distance,
      isRecurring,
      recurrence
    } = req.body;

    // ✅ Calculer automatiquement l'heure d'arrivée estimée
    const departureDate = new Date(departureDateTime);
    const estimatedArrivalDateTime = new Date(departureDate.getTime() + (estimatedDuration * 60 * 1000));

    // Créer le trajet
    const trip = await Trip.create({
      driver: req.user.id,
      departure,
      arrival,
      departureDateTime: departureDate,
      estimatedArrivalDateTime, // ✅ Ajouté automatiquement
      estimatedDuration,
      availableSeats,
      totalSeats: availableSeats,
      pricePerSeat,
      vehicle,
      preferences,
      description,
      notes,
      distance,
      isRecurring,
      recurrence
    });

    // Populer les données du conducteur
    await trip.populate('driver', 'profile.displayName profile.avatar stats.rating');

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      trip
    });

  } catch (error) {
    console.error('Create trip error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during trip creation'
    });
  }
};

// @desc    Rechercher des trajets
// @route   GET /api/trips/search
// @access  Public
const searchTrips = async (req, res) => {
  try {
    const {
      departureCity,
      arrivalCity,
      departureDate,
      passengers = 1,
      maxPrice,
      allowSmoking,
      allowPets,
      page = 1,
      limit = 10
    } = req.query;

    // Validation des paramètres requis
    if (!departureCity || !arrivalCity || !departureDate) {
      return res.status(400).json({
        success: false,
        message: 'Departure city, arrival city, and departure date are required'
      });
    }

    const searchParams = {
      departureCity,
      arrivalCity,
      departureDate,
      passengers: parseInt(passengers),
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      preferences: {
        allowSmoking: allowSmoking === 'true',
        allowPets: allowPets === 'true'
      }
    };

    // Rechercher les trajets
    const trips = await Trip.searchTrips(searchParams);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTrips = trips.slice(startIndex, endIndex);

    // Informations de pagination
    const pagination = {
      current: parseInt(page),
      total: Math.ceil(trips.length / limit),
      count: trips.length,
      limit: parseInt(limit)
    };

    res.status(200).json({
      success: true,
      count: paginatedTrips.length,
      pagination,
      trips: paginatedTrips
    });

  } catch (error) {
    console.error('Search trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during trip search'
    });
  }
};

// @desc    Obtenir tous les trajets d'un utilisateur
// @route   GET /api/trips/my-trips
// @access  Private
const getMyTrips = async (req, res) => {
  try {
    const { status, type = 'all' } = req.query;

    let query = {};

    // Filtrer par type (conducteur ou passager)
    if (type === 'driver') {
      query.driver = req.user.id;
    } else if (type === 'passenger') {
      // Récupérer les trajets où l'utilisateur est passager via les bookings
      const bookings = await Booking.find({ 
        passenger: req.user.id,
        status: { $in: ['confirmed', 'completed'] }
      }).select('trip');
      
      const tripIds = bookings.map(booking => booking.trip);
      query._id = { $in: tripIds };
    } else {
      // Tous les trajets (conducteur + passager)
      const bookings = await Booking.find({ 
        passenger: req.user.id,
        status: { $in: ['confirmed', 'completed'] }
      }).select('trip');
      
      const tripIds = bookings.map(booking => booking.trip);
      
      query = {
        $or: [
          { driver: req.user.id },
          { _id: { $in: tripIds } }
        ]
      };
    }

    // Filtrer par statut si spécifié
    if (status) {
      query.status = status;
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar stats.rating')
      .populate({
        path: 'bookings',
        populate: {
          path: 'passenger',
          select: 'profile.displayName profile.avatar'
        }
      })
      .sort({ departureDateTime: -1 });

    res.status(200).json({
      success: true,
      count: trips.length,
      trips
    });

  } catch (error) {
    console.error('Get my trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trips'
    });
  }
};

// @desc    Obtenir un trajet par ID
// @route   GET /api/trips/:id
// @access  Public
const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driver', 'profile.displayName profile.avatar profile.bio stats.rating stats.tripsCompleted verification.isIdentityVerified createdAt')
      .populate({
        path: 'bookings',
        match: { status: 'confirmed' },
        populate: {
          path: 'passenger',
          select: 'profile.displayName profile.avatar'
        }
      });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Incrémenter le compteur de vues
    trip.stats.views += 1;
    await trip.save();

    res.status(200).json({
      success: true,
      trip
    });

  } catch (error) {
    console.error('Get trip by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trip'
    });
  }
};

// @desc    Mettre à jour un trajet
// @route   PUT /api/trips/:id
// @access  Private
const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le conducteur
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trip'
      });
    }

    // Vérifier qu'il n'y a pas de réservations confirmées si on modifie des éléments critiques
    const confirmedBookings = await Booking.countDocuments({
      trip: trip._id,
      status: 'confirmed'
    });

    const criticalFields = ['departureDateTime', 'departure', 'arrival', 'availableSeats'];
    const hasCriticalChanges = criticalFields.some(field => req.body[field] !== undefined);

    if (confirmedBookings > 0 && hasCriticalChanges) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify critical trip details when there are confirmed bookings'
      });
    }

    // Champs autorisés à la modification
    const allowedFields = [
      'departure', 'arrival', 'departureDateTime', 'estimatedDuration',
      'availableSeats', 'pricePerSeat', 'vehicle', 'preferences',
      'description', 'notes', 'distance'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).populate('driver', 'profile.displayName profile.avatar stats.rating');

    res.status(200).json({
      success: true,
      message: 'Trip updated successfully',
      trip: updatedTrip
    });

  } catch (error) {
    console.error('Update trip error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during trip update'
    });
  }
};

// @desc    Supprimer un trajet
// @route   DELETE /api/trips/:id
// @access  Private
const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le conducteur
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trip'
      });
    }

    // Vérifier qu'il n'y a pas de réservations confirmées
    const confirmedBookings = await Booking.countDocuments({
      trip: trip._id,
      status: 'confirmed'
    });

    if (confirmedBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trip with confirmed bookings. Cancel the trip instead.'
      });
    }

    // Annuler toutes les réservations en attente
    await Booking.updateMany(
      { trip: trip._id, status: 'pending' },
      { 
        status: 'cancelled',
        cancelledAt: new Date(),
        $push: {
          statusHistory: {
            status: 'cancelled',
            changedBy: req.user.id,
            reason: 'Trip deleted by driver'
          }
        }
      }
    );

    // Supprimer le trajet
    await trip.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Trip deleted successfully'
    });

  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during trip deletion'
    });
  }
};

// @desc    Annuler un trajet
// @route   PUT /api/trips/:id/cancel
// @access  Private
const cancelTrip = async (req, res) => {
  try {
    const { reason } = req.body;
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le conducteur
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this trip'
      });
    }

    if (trip.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Trip is already cancelled'
      });
    }

    // Mettre à jour le statut du trajet
    trip.status = 'cancelled';
    await trip.save();

    // Annuler toutes les réservations et traiter les remboursements
    const bookings = await Booking.find({
      trip: trip._id,
      status: { $in: ['pending', 'confirmed'] }
    });

    for (const booking of bookings) {
      await booking.cancel(req.user.id, reason || 'Trip cancelled by driver');
    }

    res.status(200).json({
      success: true,
      message: 'Trip cancelled successfully',
      trip
    });

  } catch (error) {
    console.error('Cancel trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during trip cancellation'
    });
  }
};

// @desc    Obtenir les trajets populaires
// @route   GET /api/trips/popular
// @access  Public
const getPopularTrips = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const trips = await Trip.find({
      status: 'active',
      departureDateTime: { $gte: new Date() }
    })
    .populate('driver', 'profile.displayName profile.avatar stats.rating')
    .sort({ 'stats.views': -1, 'stats.bookingRequests': -1 })
    .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: trips.length,
      trips
    });

  } catch (error) {
    console.error('Get popular trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching popular trips'
    });
  }
};

module.exports = {
  createTrip,
  searchTrips,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  cancelTrip,
  getPopularTrips
};