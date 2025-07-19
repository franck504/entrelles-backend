const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Créer un nouveau trajet
// @route   POST /api/trips
// @access  Private (avec KYC vérifié)
const createTrip = async (req, res) => {
  try {
    console.log('🚗 Vérification KYC pour création de trajet...');
    
    // ✅ VÉRIFICATION KYC OBLIGATOIRE
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const kycStatus = user.getKycStatus();
    
    // ✅ BLOQUER SI KYC NON VÉRIFIÉ
    if (!kycStatus.canReceivePayments) {
      return res.status(403).json({
        success: false,
        message: 'Vérification KYC requise pour créer des trajets payants',
        error: 'KYC_VERIFICATION_REQUIRED',
        kyc: {
          status: kycStatus.status,
          message: kycStatus.message,
          nextAction: kycStatus.nextAction,
          connectAccountId: kycStatus.connectAccountId
        },
        action: {
          type: 'kyc_required',
          title: 'Vérification requise',
          description: 'Vous devez compléter votre vérification d\'identité pour créer des trajets payants',
          buttonText: 'Compléter la vérification',
          redirectTo: '/kyc/start'
        }
      });
    }
    
    console.log('✅ KYC vérifié, création du trajet autorisée');

    // Vérifier que la distance est fournie et valide
    if (!req.body.distance || isNaN(req.body.distance) || req.body.distance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Une distance valide est obligatoire pour créer un trajet',
        field: 'distance'
      });
    }

    // Vérifier que le nombre de places est valide
    if (!req.body.totalSeats || isNaN(req.body.totalSeats) || req.body.totalSeats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le nombre de places doit être supérieur à 0',
        field: 'totalSeats'
      });
    }

    // Calcul du prix unitaire par place selon la formule : 0.55 * distance
    const pricePerKm = 0.55; // Prix par kilomètre par place
    const exactPricePerSeat = pricePerKm * req.body.distance;
    const pricePerSeat = Math.ceil(exactPricePerSeat * 100) / 100; // Arrondir au centime supérieur
    
    // Définir le prix unitaire par place
    req.body.pricePerSeat = pricePerSeat;
    console.log(`💰 Prix unitaire calculé: ${pricePerSeat}€/place (${req.body.distance}km × ${pricePerKm}€/km)`);

    // Les données sont déjà enrichies par le middleware
    const tripData = {
      driver: req.user.id,
      ...req.body,
      status: 'active'
    };

    // Calculer l'heure d'arrivée
    if (req.body.departureDateTime && req.body.estimatedDuration) {
      tripData.estimatedArrivalDateTime = new Date(
        new Date(req.body.departureDateTime).getTime() + 
        (req.body.estimatedDuration * 60 * 1000)
      );
    }

    console.log('📊 Données finales:', tripData);

    const trip = await Trip.create(tripData);
    await trip.populate('driver', 'profile.displayName profile.avatar stats.rating email');

    res.status(201).json({
      success: true,
      message: 'Trajet créé avec succès',
      trip: {
        id: trip._id,
        departure: trip.departure,
        arrival: trip.arrival,
        departureDateTime: trip.departureDateTime,
        estimatedArrivalDateTime: trip.estimatedArrivalDateTime,
        availableSeats: trip.availableSeats,
        totalSeats: trip.totalSeats,
        pricePerSeat: trip.pricePerSeat,
        distance: trip.distance,
        estimatedDuration: trip.estimatedDuration,
        description: trip.description,
        driver: {
          id: trip.driver._id,
          displayName: trip.driver.profile.displayName,
          email: trip.driver.email
        },
        createdAt: trip.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur création trajet:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du trajet',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Obtenir tous les trajets
// @route   GET /api/trips
// @access  Public
const getAllTrips = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const trips = await Trip.find({ status: 'active' })
      .populate('driver', 'profile.displayName profile.avatar stats.rating')
      .sort({ departureDateTime: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Trip.countDocuments({ status: 'active' });

    res.status(200).json({
      success: true,
      count: trips.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      trips
    });

  } catch (error) {
    console.error('❌ Get all trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trips'
    });
  }
};

// @desc    Obtenir un trajet par ID
// @route   GET /api/trips/:id
// @access  Public
const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driver', 'profile.displayName profile.avatar stats.rating verification.isIdentityVerified');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    res.status(200).json({
      success: true,
      trip
    });

  } catch (error) {
    console.error('❌ Get trip by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching trip'
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

    // Champs autorisés à la modification
    const allowedFields = [
      'departure', 'arrival', 'departureDateTime', 'estimatedArrivalDateTime',
      'availableSeats', 'pricePerSeat', 'description', 'notes', 'preferences'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('driver', 'profile.displayName profile.avatar stats.rating');

    res.status(200).json({
      success: true,
      message: 'Trip updated successfully',
      trip: updatedTrip
    });

  } catch (error) {
    console.error('❌ Update trip error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating trip'
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

    // Vérifier s'il y a des réservations confirmées
    const confirmedBookings = await Booking.countDocuments({
      trip: req.params.id,
      status: { $in: ['confirmed', 'paid'] }
    });

    if (confirmedBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trip with confirmed bookings'
      });
    }

    // Marquer comme annulé au lieu de supprimer
    trip.status = 'cancelled';
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Trip cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Delete trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting trip'
    });
  }
};

// @desc    Rechercher des trajets
// @route   GET /api/trips/search
// @access  Public
const searchTrips = async (req, res) => {
  try {
    const { from, to, date, seats } = req.query;

    let query = { status: 'active' };

    // Filtres de recherche
    if (from) {
      query['departure.city'] = new RegExp(from, 'i');
    }

    if (to) {
      query['arrival.city'] = new RegExp(to, 'i');
    }

    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.departureDateTime = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    if (seats) {
      query.availableSeats = { $gte: parseInt(seats) };
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar stats.rating')
      .sort({ departureDateTime: 1 })
      .limit(20);

    res.status(200).json({
      success: true,
      count: trips.length,
      trips
    });

  } catch (error) {
    console.error('❌ Search trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching trips'
    });
  }
};

// @desc    Obtenir mes trajets
// @route   GET /api/trips/my/trips
// @access  Private
const getMyTrips = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, type } = req.query;

    let query = { driver: userId };

    if (status) {
      query.status = status;
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar')
      .sort({ departureDateTime: -1 });

    // Ajouter les informations de réservation
    const tripsWithBookings = await Promise.all(
      trips.map(async (trip) => {
        const bookings = await Booking.find({ trip: trip._id })
          .populate('passenger', 'profile.displayName profile.avatar')
          .select('numberOfSeats status passenger totalPrice');

        return {
          ...trip.toObject(),
          bookings
        };
      })
    );

    res.status(200).json({
      success: true,
      count: tripsWithBookings.length,
      trips: tripsWithBookings
    });

  } catch (error) {
    console.error('❌ Get my trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your trips'
    });
  }
};

// @desc    Obtenir les statistiques de trajets
// @route   GET /api/trips/my/stats
// @access  Private
const getTripStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Statistiques des trajets créés
    const tripStats = await Trip.aggregate([
      { $match: { driver: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDistance: { $sum: '$distance' }
        }
      }
    ]);

    // Statistiques des réservations reçues
    const bookingStats = await Booking.aggregate([
      { $match: { driver: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        trips: tripStats,
        bookings: bookingStats
      }
    });

  } catch (error) {
    console.error('❌ Get trip stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trip statistics'
    });
  }
};

module.exports = {
  createTrip,
  getAllTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  searchTrips,
  getMyTrips,
  getTripStats
};