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

    // ✅ AJOUT: Incrémenter stats conductrice
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.tripsAsDriver': 1 }
    });
    console.log('✅ Stats conductrice mises à jour: tripsAsDriver +1');

    await trip.populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl stats.rating email');

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

// @desc    Obtenir tous les trajets (avec filtres optionnels)
// @route   GET /api/trips
// @access  Public
const getAllTrips = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Construction de la requête avec filtres optionnels
    let query = { status: 'active' };

    // Filtre par ville de départ (optionnel)
    if (req.query.departureCity) {
      query['departure.city'] = new RegExp(req.query.departureCity, 'i');
    }

    // Filtre par ville d'arrivée (optionnel)
    if (req.query.arrivalCity) {
      query['arrival.city'] = new RegExp(req.query.arrivalCity, 'i');
    }

    // Filtre par date de départ (optionnel)
    if (req.query.departureDate) {
      const searchDate = new Date(req.query.departureDate);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.departureDateTime = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    // Filtre par nombre de places disponibles (optionnel)
    if (req.query.passengers) {
      query.availableSeats = { $gte: parseInt(req.query.passengers) };
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl stats.rating')
      .sort({ departureDateTime: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Trip.countDocuments(query);

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
      .populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl stats.rating verification.isIdentityVerified');

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
    ).populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl stats.rating');

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
    if (!trip.driver.equals(req.user.id)) {
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

// @desc    Annuler un trajet (avec notifications aux passagères)
// @route   PATCH /api/trips/:id/cancel
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
    if (!trip.driver.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this trip'
      });
    }

    // Récupérer toutes les réservations pour ce trajet
    const bookings = await Booking.find({
      trip: req.params.id,
      status: { $in: ['confirmed', 'paid', 'pending'] }
    }).populate('passenger', 'email profile.displayName');

    // Annuler toutes les réservations et notifier les passagères
    const Notification = require('../models/Notification');
    for (const booking of bookings) {
      await booking.cancel(req.user.id, `Trajet annulé par la conductrice: ${reason || 'Non spécifiée'}`);

      // Créer une notification pour chaque passagère
      if (booking.passenger) {
        await Notification.create({
          recipient: booking.passenger._id,
          type: 'trip_cancelled',
          title: 'Trajet annulé',
          message: `Le trajet ${trip.departure.city} → ${trip.arrival.city} a été annulé. Raison: ${reason || 'Non spécifiée'}`,
          relatedId: trip._id.toString(),
          data: { tripId: trip._id, bookingId: booking._id, reason }
        });
      }
    }

    // Marquer le trajet comme annulé
    trip.status = 'cancelled';
    trip.cancellationReason = reason;
    trip.cancelledAt = new Date();
    await trip.save();

    console.log(`✅ Trip ${trip._id} cancelled. ${bookings.length} bookings affected.`);

    res.status(200).json({
      success: true,
      message: 'Trip cancelled successfully',
      data: { tripId: trip._id, bookingsAffected: bookings.length, reason }
    });

  } catch (error) {
    console.error('❌ Cancel trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling trip'
    });
  }
};

// @desc    Obtenir les trajets populaires
// @route   GET /api/trips/popular
// @access  Public
const getPopularTrips = async (req, res) => {
  try {
    const trips = await Trip.find({
      status: 'active',
      departureDateTime: { $gte: new Date() }
    })
      .sort({ 'stats.views': -1, 'stats.bookingRequests': -1 })
      .limit(10)
      .populate('driver', 'profile.displayName profile.photoUrl rating');

    res.status(200).json({
      success: true,
      count: trips.length,
      trips
    });
  } catch (error) {
    console.error('❌ Get popular trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular trips'
    });
  }
};

// @desc    Rechercher des trajets
// @route   GET /api/trips/search
// @access  Public
const searchTrips = async (req, res) => {
  try {
    const { from, to, date, seats, maxPrice } = req.query;

    let query = { status: 'active' };

    // Filtres de recherche de base
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

    // ✅ FILTRE PRIX MAXIMUM (Gère aussi le prix 0)
    if (maxPrice !== undefined && maxPrice !== '' && !isNaN(parseFloat(maxPrice))) {
      query.pricePerSeat = { $lte: parseFloat(maxPrice) };
    }

    // ✅ FILTRES PRÉFÉRENCES DYNAMIQUES
    // Parcourt tous les paramètres commençant par "preferences."
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('preferences.')) {
        let value = req.query[key];

        // Conversion des types (HTTP query strings sont toujours des strings)
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        if (!isNaN(value) && value !== '' && typeof value === 'string' && key.includes('maxDetour')) {
          value = parseInt(value);
        }

        query[key] = value;
      }
    });

    console.log('🔍 MongoDB Search Query:', JSON.stringify(query));

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl stats.rating')
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
      .populate('driver', 'profile.displayName profile.avatar profile.profileImageUrl profile.vehicleImageUrl')
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

// @desc    Supprimer tous les trajets (DEV/ADMIN)
// @route   DELETE /api/trips/delete-all
// @access  Private
const deleteAllTrips = async (req, res) => {
  try {
    await Trip.deleteMany({});
    console.log('🗑️ Tous les trajets ont été supprimés');
    res.status(200).json({
      success: true,
      message: 'Tous les trajets ont été supprimés'
    });
  } catch (error) {
    console.error('❌ Erreur suppression trajets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des trajets'
    });
  }
};

// @desc    Marquer un trajet comme vu
// @route   POST /api/trips/:id/view
// @access  Private
const markTripAsViewed = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user.id;

    // Utiliser $addToSet pour s'assurer que l'utilisateur n'est ajouté qu'une seule fois
    // On incrémente views seulement si l'utilisateur n'était pas déjà dans viewers
    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    // Ne rien faire si c'est le conducteur
    if (trip.driver.toString() === userId.toString()) {
      return res.status(200).json({
        success: true,
        message: 'Conductrice ignorée pour les stats de vue'
      });
    }

    const alreadyViewed = trip.stats.viewers.includes(userId);

    if (!alreadyViewed) {
      await Trip.findByIdAndUpdate(tripId, {
        $addToSet: { 'stats.viewers': userId },
        $inc: { 'stats.views': 1 }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vue enregistrée'
    });

  } catch (error) {
    console.error('❌ Error marking trip as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la vue'
    });
  }
};

module.exports = {
  createTrip,
  getAllTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  cancelTrip,
  searchTrips,
  getMyTrips,
  getTripStats,
  deleteAllTrips,
  markTripAsViewed,
  getPopularTrips
};
