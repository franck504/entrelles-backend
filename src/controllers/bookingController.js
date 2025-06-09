const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');

// @desc    Créer une nouvelle réservation
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const {
      tripId,
      numberOfSeats = 1,
      message,
      customPickup,
      customDropoff,
      emergencyContact
    } = req.body;

    // Vérifier que le trajet existe
    const trip = await Trip.findById(tripId).populate('driver');
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier la disponibilité
    if (!trip.canBeBookedBy(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'This trip cannot be booked'
      });
    }

    if (trip.availableSeats < numberOfSeats) {
      return res.status(400).json({
        success: false,
        message: `Only ${trip.availableSeats} seats available`
      });
    }

    // Calculer le prix total
    const totalPrice = trip.pricePerSeat * numberOfSeats;

    // Créer la réservation
    const booking = await Booking.create({
      trip: tripId,
      passenger: req.user.id,
      driver: trip.driver._id,
      numberOfSeats,
      totalPrice,
      message,
      customPickup,
      customDropoff,
      emergencyContact,
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        source: 'web'
      }
    });

    // Incrémenter le compteur de demandes de réservation
    trip.stats.bookingRequests += 1;
    await trip.save();

    // Populer les données
    await booking.populate([
      { path: 'trip', select: 'departure arrival departureDateTime pricePerSeat' },
      { path: 'passenger', select: 'profile.displayName profile.avatar profile.phone' },
      { path: 'driver', select: 'profile.displayName profile.avatar profile.phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    
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
      message: 'Server error during booking creation'
    });
  }
};

// @desc    Obtenir toutes les réservations de l'utilisateur
// @route   GET /api/bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const { status, type = 'all' } = req.query;

    let bookings;

    if (type === 'passenger') {
      // Réservations en tant que passagère
      let query = { passenger: req.user.id };
      if (status) query.status = status;
      
      bookings = await Booking.find(query)
        .populate('trip', 'departure arrival departureDateTime pricePerSeat status')
        .populate('driver', 'profile.displayName profile.avatar profile.phone stats.rating')
        .sort({ requestedAt: -1 });
        
    } else if (type === 'driver') {
      // Réservations pour mes trajets (en tant que conductrice)
      let query = { driver: req.user.id };
      if (status) query.status = status;
      
      bookings = await Booking.find(query)
        .populate('trip', 'departure arrival departureDateTime pricePerSeat status')
        .populate('passenger', 'profile.displayName profile.avatar profile.phone stats.rating')
        .sort({ requestedAt: -1 });
        
    } else {
      // Toutes les réservations
      bookings = await Booking.getBookingsByUser(req.user.id, status);
    }

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
};

// @desc    Obtenir une réservation par ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName profile.avatar profile.phone profile.bio stats.rating')
      .populate('driver', 'profile.displayName profile.avatar profile.phone profile.bio stats.rating');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking'
    });
  }
};

// @desc    Confirmer une réservation (conductrice)
// @route   PUT /api/bookings/:id/confirm
// @access  Private
const confirmBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;

    console.log('🔍 DEBUG - Booking ID reçu:', bookingId);

    // Trouver la réservation avec le trajet populé
    const booking = await Booking.findById(bookingId).populate('trip');
    
    if (!booking) {
      console.log('❌ Booking not found with ID:', bookingId);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log('✅ Booking trouvé:', booking._id);

    // Vérifier que la réservation est en attente
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Booking is not in pending status. Current status: ${booking.status}`
      });
    }

    // Confirmer la réservation
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    await booking.save();

    console.log('✅ Booking confirmé avec succès');

    // Populer les données pour la réponse
    await booking.populate('passenger', 'profile.displayName profile.avatar');

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking
    });

  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during booking confirmation'
    });
  }
};

// @desc    Annuler une réservation
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const bookingId = req.params.id;
    
    const booking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Annuler la réservation
    await booking.cancel(req.user.id, reason);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error during booking cancellation'
    });
  }
};

// @desc    Marquer une réservation comme terminée
// @route   PUT /api/bookings/:id/complete
// @access  Private
const completeBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    const booking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Marquer comme terminé
    await booking.complete();

    // Mettre à jour les statistiques des utilisateurs
    const User = require('../models/User');
    await User.findByIdAndUpdate(booking.driver, {
      $inc: { 'stats.tripsCompleted': 1 }
    });
    await User.findByIdAndUpdate(booking.passenger, {
      $inc: { 'stats.tripsAsPassenger': 1 }
    });

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed',
      booking
    });

  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error during booking completion'
    });
  }
};

// @desc    Ajouter une évaluation à une réservation
// @route   PUT /api/bookings/:id/review
// @access  Private
const addReview = async (req, res) => {
  try {
    console.log('🔍 Starting addReview controller...');
    
    const { rating, comment } = req.body;
    const bookingId = req.params.id;

    // Validation du rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    console.log(`🔍 Adding review for booking ${bookingId} with rating ${rating}`);

    // Trouver la réservation
    const booking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log('✅ Booking found, calling addReview method...');

    // ✅ SIMPLIFICATION: Appeler directement la méthode
    await booking.addReview(rating, comment);

    console.log('✅ Review added successfully');

    // Recharger la réservation avec toutes les données
    const updatedBooking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName profile.avatar')
      .populate('driver', 'profile.displayName profile.avatar stats.rating stats.ratingsCount');

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('❌ Add review controller error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error while adding review'
    });
  }
};

// @desc    Obtenir les réservations à venir
// @route   GET /api/bookings/upcoming
// @access  Private
const getUpcomingBookings = async (req, res) => {
  try {
    const bookings = await Booking.getUpcomingBookings(req.user.id);

    // Filtrer les bookings avec des trips valides
    const validBookings = bookings.filter(booking => booking.trip);

    res.status(200).json({
      success: true,
      count: validBookings.length,
      bookings: validBookings
    });

  } catch (error) {
    console.error('Get upcoming bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming bookings'
    });
  }
};

// @desc    Obtenir les demandes de réservation en attente (pour conductrice)
// @route   GET /api/bookings/pending-requests
// @access  Private
const getPendingRequests = async (req, res) => {
  try {
    // ❌ SUPPRIMÉ - Filtrage par conducteur, maintenant on récupère toutes les demandes
    const bookings = await Booking.find({
      status: 'pending'
    })
    .populate('trip', 'departure arrival departureDateTime pricePerSeat')
    .populate('passenger', 'profile.displayName profile.avatar profile.bio stats.rating')
    .populate('driver', 'profile.displayName profile.avatar')
    .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pending requests'
    });
  }
};

// @desc    Obtenir les statistiques de réservation
// @route   GET /api/bookings/stats
// @access  Private
const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Statistiques en tant que passagère
    const passengerStats = await Booking.aggregate([
      { $match: { passenger: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Statistiques en tant que conductrice
    const driverStats = await Booking.aggregate([
      { $match: { driver: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Réservations récentes
    const recentBookings = await Booking.find({
      $or: [
        { passenger: userId },
        { driver: userId }
      ]
    })
    .populate('trip', 'departure arrival departureDateTime')
    .sort({ requestedAt: -1 })
    .limit(5);

    const stats = {
      asPassenger: passengerStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {}),
      asDriver: driverStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {}),
      recentBookings
    };

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking statistics'
    });
  }
};

module.exports = {
  createBooking,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getMyBookings,
  getUpcomingBookings,
  getPendingRequests,
  getBookingStats
};