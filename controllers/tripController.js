const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const User = require('../models/User');

/**
 * @desc    Créer un nouveau trajet
 * @route   POST /api/trips
 * @access  Privé (KYC vérifié requis)
 */
const createTrip = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const kycStatus = user.getKycStatus();

    // Vérification de l'éligibilité aux paiements (KYC)
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
        }
      });
    }

    // Validation de la distance
    if (!req.body.distance || isNaN(req.body.distance) || req.body.distance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Une distance valide est obligatoire pour créer un trajet'
      });
    }

    // Validation du nombre de places
    if (!req.body.totalSeats || isNaN(req.body.totalSeats) || req.body.totalSeats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le nombre de places doit être supérieur à 0'
      });
    }

    // Calcul du prix par place (0.55€/km par défaut)
    const pricePerKm = 0.55;
    const exactPricePerSeat = pricePerKm * req.body.distance;
    const pricePerSeat = Math.ceil(exactPricePerSeat * 100) / 100;

    const tripData = {
      driver: req.user.id,
      ...req.body,
      pricePerSeat,
      status: 'active'
    };

    // Calcul de l'heure d'arrivée estimée
    if (req.body.departureDateTime && req.body.estimatedDuration) {
      tripData.estimatedArrivalDateTime = new Date(
        new Date(req.body.departureDateTime).getTime() +
        (req.body.estimatedDuration * 60 * 1000)
      );
    }

    const trip = await Trip.create(tripData);

    // Mise à jour des statistiques de la conductrice
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.tripsAsDriver': 1 }
    });

    await trip.populate('driver', 'profile.displayName profile.avatar email');

    res.status(201).json({
      success: true,
      message: 'Trajet créé avec succès',
      trip
    });

  } catch (error) {
    console.error('Erreur lors de la création du trajet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du trajet'
    });
  }
};

/**
 * @desc    Obtenir tous les trajets actifs avec filtres
 * @route   GET /api/trips
 * @access  Public
 */
const getAllTrips = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { status: 'active' };

    if (req.query.departureCity) {
      query['departure.city'] = new RegExp(req.query.departureCity, 'i');
    }

    if (req.query.arrivalCity) {
      query['arrival.city'] = new RegExp(req.query.arrivalCity, 'i');
    }

    if (req.query.departureDate) {
      const searchDate = new Date(req.query.departureDate);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.departureDateTime = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    if (req.query.passengers) {
      query.availableSeats = { $gte: parseInt(req.query.passengers) };
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar stats.rating')
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
    console.error('Erreur lors de la récupération des trajets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des trajets'
    });
  }
};

/**
 * @desc    Obtenir les détails d'un trajet par son ID
 * @route   GET /api/trips/:id
 * @access  Public
 */
const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driver', 'profile.displayName profile.avatar stats.rating verification.isIdentityVerified');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      trip
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du trajet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du trajet'
    });
  }
};

/**
 * @desc    Mettre à jour un trajet existant
 * @route   PUT /api/trips/:id
 * @access  Privé (Conductrice seulement)
 */
const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce trajet'
      });
    }

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
      message: 'Trajet mis à jour avec succès',
      trip: updatedTrip
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du trajet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du trajet'
    });
  }
};

/**
 * @desc    Annuler un trajet
 * @route   PATCH /api/trips/:id/cancel
 * @access  Privé (Conductrice seulement)
 */
const cancelTrip = async (req, res) => {
  try {
    const { reason } = req.body;
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    if (!trip.driver.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à annuler ce trajet'
      });
    }

    // Gestion des réservations liées
    const bookings = await Booking.find({
      trip: req.params.id,
      status: { $in: ['confirmed', 'paid', 'pending'] }
    });

    const Notification = require('../models/Notification');
    for (const booking of bookings) {
      await booking.cancel(req.user.id, `Trajet annulé par la conductrice: ${reason || 'Non spécifiée'}`);

      await Notification.create({
        recipient: booking.passenger,
        type: 'trip_cancelled',
        title: 'Trajet annulé',
        message: `Le trajet ${trip.departure.city} → ${trip.arrival.city} a été annulé. Raison: ${reason || 'Non spécifiée'}`,
        relatedId: trip._id.toString()
      });
    }

    trip.status = 'cancelled';
    trip.cancellationReason = reason;
    trip.cancelledAt = new Date();
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Trajet annulé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'annulation du trajet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation du trajet'
    });
  }
};

/**
 * @desc    Rechercher des trajets avec filtres avancés
 * @route   GET /api/trips/search
 * @access  Public
 */
const searchTrips = async (req, res) => {
  try {
    const { from, to, date, seats, maxPrice } = req.query;
    let query = { status: 'active' };

    if (from) query['departure.city'] = new RegExp(from, 'i');
    if (to) query['arrival.city'] = new RegExp(to, 'i');

    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.departureDateTime = { $gte: searchDate, $lt: nextDay };
    }

    if (seats) query.availableSeats = { $gte: parseInt(seats) };
    if (maxPrice && !isNaN(parseFloat(maxPrice))) query.pricePerSeat = { $lte: parseFloat(maxPrice) };

    // Filtres dynamiques sur les préférences
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('preferences.')) {
        let value = req.query[key];
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        query[key] = value;
      }
    });

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
    console.error('Erreur lors de la recherche de trajets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de trajets'
    });
  }
};

/**
 * @desc    Obtenir les trajets de l'utilisateur connecté
 * @route   GET /api/trips/my/trips
 * @access  Privé
 */
const getMyTrips = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = { driver: userId };
    if (status) query.status = status;

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar')
      .sort({ departureDateTime: -1 });

    const tripsWithBookings = await Promise.all(
      trips.map(async (trip) => {
        const bookings = await Booking.find({ trip: trip._id })
          .populate('passenger', 'profile.displayName profile.avatar')
          .select('numberOfSeats status passenger totalPrice');

        return { ...trip.toObject(), bookings };
      })
    );

    res.status(200).json({
      success: true,
      count: tripsWithBookings.length,
      trips: tripsWithBookings
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de vos trajets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos trajets'
    });
  }
};

/**
 * @desc    Enregistrer une vue sur un trajet
 * @route   POST /api/trips/:id/view
 * @access  Privé
 */
const markTripAsViewed = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user.id;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, message: 'Trajet non trouvé' });

    // On n'enregistre pas la vue si c'est la conductrice elle-même
    if (trip.driver.toString() === userId.toString()) {
      return res.status(200).json({ success: true, message: 'Vue ignorée (conductrice)' });
    }

    if (!trip.stats.viewers.includes(userId)) {
      await Trip.findByIdAndUpdate(tripId, {
        $addToSet: { 'stats.viewers': userId },
        $inc: { 'stats.views': 1 }
      });
    }

    res.status(200).json({ success: true, message: 'Vue enregistrée' });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la vue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  createTrip,
  getAllTrips,
  getTripById,
  updateTrip,
  cancelTrip,
  searchTrips,
  getMyTrips,
  markTripAsViewed
};
