const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');

// ✅ MÉTHODE MODIFIÉE - Créer une nouvelle réservation (avec paiement)
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
      emergencyContact,
      requiresPayment = true // ✅ NOUVEAU : Option paiement immédiat
    } = req.body;

    console.log('🔍 Creating booking for trip:', tripId, 'seats:', numberOfSeats);

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
      // ✅ NOUVEAU : Initialiser le paiement
      payment: {
        amount: totalPrice * 100, // En centimes
        status: 'pending',
        currency: 'eur'
      },
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
      { path: 'trip', select: 'departure arrival departureDateTime pricePerSeat distance' },
      { path: 'passenger', select: 'profile.displayName profile.avatar profile.phone' },
      { path: 'driver', select: 'profile.displayName profile.avatar profile.phone' }
    ]);

    console.log('✅ Booking created successfully:', booking._id);

    // ✅ NOUVEAU : Créer PaymentIntent si paiement requis
    let paymentIntent = null;
    if (requiresPayment && typeof booking.createPaymentIntent === 'function') {
      try {
        console.log('💳 Creating payment intent...');
        paymentIntent = await booking.createPaymentIntent(trip.distance);
        console.log('✅ Payment intent created:', paymentIntent.id);
      } catch (paymentError) {
        console.error('❌ Payment intent creation failed:', paymentError);
        // Ne pas faire échouer la réservation si le paiement échoue
      }
    } else {
      console.log('⚠️ Payment not required or method not available');
    }

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      booking: {
        id: booking._id,
        trip: {
          id: booking.trip._id,
          departure: booking.trip.departure,
          arrival: booking.trip.arrival,
          departureDateTime: booking.trip.departureDateTime,
          pricePerSeat: booking.trip.pricePerSeat,
          distance: booking.trip.distance
        },
        passenger: {
          id: booking.passenger._id,
          displayName: booking.passenger.profile.displayName,
          avatar: booking.passenger.profile.avatar,
          phone: booking.passenger.profile.phone
        },
        driver: {
          id: booking.driver._id,
          displayName: booking.driver.profile.displayName,
          avatar: booking.driver.profile.avatar,
          phone: booking.driver.profile.phone
        },
        numberOfSeats: booking.numberOfSeats,
        totalPrice: booking.totalPrice,
        status: booking.status,
        message: booking.message,
        // ✅ NOUVEAU : Informations paiement
        payment: {
          status: booking.payment.status,
          amount: booking.payment.amount,
          currency: booking.payment.currency,
          clientSecret: paymentIntent?.client_secret || null,
          requiresPayment: requiresPayment
        },
        requestedAt: booking.requestedAt
      }
    });

  } catch (error) {
    console.error('❌ Create booking error:', error);
    
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
      message: 'Server error during booking creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ MÉTHODE MODIFIÉE - Obtenir toutes les réservations (avec infos paiement)
// @desc    Obtenir toutes les réservations de l'utilisateur
// @route   GET /api/bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const { status, type = 'all', includePayment = 'true' } = req.query;

    let bookings;

    if (type === 'passenger') {
      // Réservations en tant que passagère
      let query = { passenger: req.user.id };
      if (status) query.status = status;
      
      bookings = await Booking.find(query)
        .populate('trip', 'departure arrival departureDateTime pricePerSeat status distance')
        .populate('driver', 'profile.displayName profile.avatar profile.phone stats.rating')
        .sort({ requestedAt: -1 });
        
    } else if (type === 'driver') {
      // Réservations pour mes trajets (en tant que conductrice)
      let query = { driver: req.user.id };
      if (status) query.status = status;
      
      bookings = await Booking.find(query)
        .populate('trip', 'departure arrival departureDateTime pricePerSeat status distance')
        .populate('passenger', 'profile.displayName profile.avatar profile.phone stats.rating')
        .sort({ requestedAt: -1 });
        
    } else {
      // Toutes les réservations
      bookings = await Booking.getBookingsByUser(req.user.id, status);
    }

    // ✅ NOUVEAU : Enrichir avec infos paiement si demandé
    const enrichedBookings = bookings.map(booking => {
      const bookingData = {
        id: booking._id,
        trip: booking.trip,
        passenger: booking.passenger,
        driver: booking.driver,
        numberOfSeats: booking.numberOfSeats,
        totalPrice: booking.totalPrice,
        status: booking.status,
        message: booking.message,
        requestedAt: booking.requestedAt,
        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        completedAt: booking.completedAt,
        review: booking.review
      };

      // Ajouter infos paiement si demandé
      if (includePayment === 'true') {
        bookingData.payment = {
          status: booking.payment?.status || 'pending',
          amount: booking.payment?.amount || 0,
          currency: booking.payment?.currency || 'eur',
          paidAt: booking.payment?.paidAt,
          refundedAt: booking.payment?.refundedAt,
          commission: booking.payment?.commission,
          driverPayout: booking.payment?.driverPayout
        };
      }

      return bookingData;
    });

    res.status(200).json({
      success: true,
      count: enrichedBookings.length,
      bookings: enrichedBookings
    });

  } catch (error) {
    console.error('❌ Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
};

// ✅ MÉTHODE MODIFIÉE - Obtenir une réservation par ID (avec infos paiement)
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

    // Vérifier que l'utilisateur est impliqué dans cette réservation
  if (booking.passenger._id.toString() !== req.user.id.toString() &&
    booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    // ✅ NOUVEAU : Inclure infos paiement complètes
    const bookingData = {
      id: booking._id,
      trip: booking.trip,
      passenger: booking.passenger,
      driver: booking.driver,
      numberOfSeats: booking.numberOfSeats,
      totalPrice: booking.totalPrice,
      status: booking.status,
      message: booking.message,
      customPickup: booking.customPickup,
      customDropoff: booking.customDropoff,
      emergencyContact: booking.emergencyContact,
      requestedAt: booking.requestedAt,
      confirmedAt: booking.confirmedAt,
      cancelledAt: booking.cancelledAt,
      completedAt: booking.completedAt,
      cancellationReason: booking.cancellationReason,
      review: booking.review,
      // ✅ NOUVEAU : Infos paiement détaillées
      payment: {
        status: booking.payment?.status || 'pending',
        amount: booking.payment?.amount || 0,
        currency: booking.payment?.currency || 'eur',
        paidAt: booking.payment?.paidAt,
        failureReason: booking.payment?.failureReason,
        refundId: booking.payment?.refundId,
        refundedAt: booking.payment?.refundedAt,
        refundAmount: booking.payment?.refundAmount,
        commission: booking.payment?.commission,
        driverPayout: booking.payment?.driverPayout,
        stripePaymentIntentId: booking.payment?.stripePaymentIntentId
      },
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };

    res.status(200).json({
      success: true,
      booking: bookingData
    });

  } catch (error) {
    console.error('❌ Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking'
    });
  }
};

// ✅ MÉTHODE MODIFIÉE - Confirmer une réservation (avec gestion paiement)
// @desc    Confirmer une réservation (conductrice)
// @route   PUT /api/bookings/:id/confirm
// @access  Private
const confirmBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { requiresPayment = true } = req.body; // ✅ NOUVEAU : Option paiement

    console.log('🔍 Confirming booking:', bookingId, 'requiresPayment:', requiresPayment);

    // Trouver la réservation avec le trajet populé
    const booking = await Booking.findById(bookingId)
      .populate('trip')
      .populate('passenger', 'profile.displayName profile.avatar email')
      .populate('driver', 'profile.displayName profile.avatar');
    
    if (!booking) {
      console.log('❌ Booking not found with ID:', bookingId);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Vérifier que l'utilisateur est le conducteur
    if (booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can confirm this booking'
      });
    }

    // Vérifier que la réservation est en attente
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Booking is not in pending status. Current status: ${booking.status}`
      });
    }

    console.log('✅ Booking validation passed');

    // ✅ NOUVEAU : Gestion du paiement
    let paymentIntent = null;
    
    if (requiresPayment) {
      // Vérifier si PaymentIntent existe déjà
      if (!booking.payment.stripePaymentIntentId) {
        console.log('💳 Creating payment intent for confirmed booking...');
        try {
          paymentIntent = await booking.createPaymentIntent(booking.trip.distance);
          console.log('✅ Payment intent created:', paymentIntent.id);
        } catch (paymentError) {
          console.error('❌ Payment intent creation failed:', paymentError);
          return res.status(500).json({
            success: false,
            message: 'Failed to create payment intent',
            error: paymentError.message
          });
        }
      } else {
        console.log('💳 Payment intent already exists:', booking.payment.stripePaymentIntentId);
      }

      // Mettre à jour le statut en "confirmed" mais paiement requis
      booking.status = 'confirmed';
      booking.confirmedAt = new Date();
      booking.payment.status = 'processing'; // En attente de paiement
      
    } else {
      // Confirmation sans paiement (cas particulier)
      booking.status = 'confirmed';
      booking.confirmedAt = new Date();
      booking.payment.status = 'succeeded'; // Considéré comme payé
      booking.payment.paidAt = new Date();
    }

    await booking.save();
    console.log('✅ Booking confirmed successfully');

    // Réduire les places disponibles du trajet
    const trip = await Trip.findById(booking.trip._id);
    if (trip) {
      trip.availableSeats = Math.max(0, trip.availableSeats - booking.numberOfSeats);
      await trip.save();
      console.log('✅ Trip seats updated:', trip.availableSeats, 'remaining');
    }

    res.status(200).json({
      success: true,
      message: requiresPayment ? 
        'Booking confirmed - Payment required to complete reservation' : 
        'Booking confirmed successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        trip: {
          id: booking.trip._id,
          departure: booking.trip.departure,
          arrival: booking.trip.arrival,
          departureDateTime: booking.trip.departureDateTime,
          availableSeats: trip?.availableSeats || booking.trip.availableSeats
        },
        passenger: {
          id: booking.passenger._id,
          displayName: booking.passenger.profile.displayName,
          avatar: booking.passenger.profile.avatar,
          email: booking.passenger.email
        },
        numberOfSeats: booking.numberOfSeats,
        totalPrice: booking.totalPrice,
        // ✅ NOUVEAU : Infos paiement
        payment: {
          status: booking.payment.status,
          amount: booking.payment.amount,
          currency: booking.payment.currency,
          clientSecret: paymentIntent?.client_secret || booking.payment.stripeClientSecret,
          requiresPayment: requiresPayment,
          paidAt: booking.payment.paidAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during booking confirmation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ MÉTHODE MODIFIÉE - Annuler une réservation (avec remboursement automatique)
// @desc    Annuler une réservation
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const bookingId = req.params.id;
    
    console.log('🔍 Cancelling booking:', bookingId, 'reason:', reason);
    
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

    // Vérifier que l'utilisateur peut annuler cette réservation
if (booking.passenger._id.toString() !== req.user.id.toString() &&
    booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // ✅ NOUVEAU : La méthode cancel() gère automatiquement le remboursement
    await booking.cancel(req.user.id, reason);

    // Remettre les places disponibles si la réservation était confirmée
    if (booking.status === 'confirmed') {
      const trip = await Trip.findById(booking.trip._id);
      if (trip) {
        trip.availableSeats += booking.numberOfSeats;
        await trip.save();
        console.log('✅ Trip seats restored:', trip.availableSeats, 'available');
      }
    }

    console.log('✅ Booking cancelled successfully');

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
        cancelledBy: booking.cancelledBy,
        // ✅ NOUVEAU : Infos remboursement
        payment: {
          status: booking.payment.status,
          refundId: booking.payment.refundId,
          refundedAt: booking.payment.refundedAt,
          refundAmount: booking.payment.refundAmount
        }
      }
    });

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error during booking cancellation'
    });
  }
};

// ✅ MÉTHODE CONSERVÉE - Marquer une réservation comme terminée
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

    // Vérifier que l'utilisateur peut marquer cette réservation comme terminée
if (booking.passenger._id.toString() !== req.user.id.toString() &&
    booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this booking'
      });
    }

    // Marquer comme terminé
    await booking.complete();

    // Mettre à jour les statistiques des utilisateurs
    const User = require('../models/User');
    await User.findByIdAndUpdate(booking.driver, {
      $inc: { 'stats.tripsCompleted': 1, 'stats.tripsAsDriver': 1 }
    });
    await User.findByIdAndUpdate(booking.passenger, {
      $inc: { 'stats.tripsAsPassenger': 1, 'stats.tripsCompleted': 1 }
    });

    console.log('✅ Booking completed and stats updated');

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed',
      booking: {
        id: booking._id,
        status: booking.status,
        completedAt: booking.completedAt,
        // ✅ NOUVEAU : Infos paiement final
        payment: {
          status: booking.payment.status,
          driverPayout: booking.payment.driverPayout
        }
      }
    });

  } catch (error) {
    console.error('❌ Complete booking error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error during booking completion'
    });
  }
};

// ✅ MÉTHODE CONSERVÉE - Ajouter une évaluation
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

    // Vérifier que l'utilisateur peut évaluer cette réservation
   if (booking.passenger._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the passenger can review this booking'
      });
    }

    console.log('✅ Booking found, calling addReview method...');

    // Appeler la méthode du modèle
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
      booking: {
        id: updatedBooking._id,
        review: updatedBooking.review,
        driver: {
          id: updatedBooking.driver._id,
          displayName: updatedBooking.driver.profile.displayName,
          avatar: updatedBooking.driver.profile.avatar,
          rating: updatedBooking.driver.stats.rating,
          ratingsCount: updatedBooking.driver.stats.ratingsCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Add review controller error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error while adding review'
    });
  }
};

// ✅ MÉTHODE CONSERVÉE - Obtenir les réservations à venir
// @desc    Obtenir les réservations à venir
// @route   GET /api/bookings/upcoming
// @access  Private
const getUpcomingBookings = async (req, res) => {
  try {
    const bookings = await Booking.getUpcomingBookings(req.user.id);

    // Filtrer les bookings avec des trips valides
    const validBookings = bookings.filter(booking => booking.trip);

    // ✅ NOUVEAU : Enrichir avec infos paiement
    const enrichedBookings = validBookings.map(booking => ({
      id: booking._id,
      trip: booking.trip,
      passenger: booking.passenger,
      driver: booking.driver,
      numberOfSeats: booking.numberOfSeats,
      totalPrice: booking.totalPrice,
      status: booking.status,
      requestedAt: booking.requestedAt,
      confirmedAt: booking.confirmedAt,
      // ✅ NOUVEAU : Statut paiement
      payment: {
        status: booking.payment?.status || 'pending',
        amount: booking.payment?.amount || 0,
        paidAt: booking.payment?.paidAt
      }
    }));

    res.status(200).json({
      success: true,
      count: enrichedBookings.length,
      bookings: enrichedBookings
    });

  } catch (error) {
    console.error('❌ Get upcoming bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming bookings'
    });
  }
};

// ✅ MÉTHODE CONSERVÉE - Obtenir les demandes en attente
// @desc    Obtenir les demandes de réservation en attente (pour conductrice)
// @route   GET /api/bookings/pending-requests
// @access  Private
const getPendingRequests = async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: 'pending'
    })
    .populate('trip', 'departure arrival departureDateTime pricePerSeat distance')
    .populate('passenger', 'profile.displayName profile.avatar profile.bio stats.rating')
    .populate('driver', 'profile.displayName profile.avatar')
    .sort({ requestedAt: -1 });

    // ✅ NOUVEAU : Enrichir avec infos paiement
    const enrichedBookings = bookings.map(booking => ({
      id: booking._id,
      trip: booking.trip,
      passenger: booking.passenger,
      driver: booking.driver,
      numberOfSeats: booking.numberOfSeats,
      totalPrice: booking.totalPrice,
      status: booking.status,
      message: booking.message,
      requestedAt: booking.requestedAt,
      // ✅ NOUVEAU : Statut paiement
      payment: {
        status: booking.payment?.status || 'pending',
        amount: booking.payment?.amount || 0
      }
    }));

    res.status(200).json({
      success: true,
      count: enrichedBookings.length,
      bookings: enrichedBookings
    });

  } catch (error) {
    console.error('❌ Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pending requests'
    });
  }
};

// ✅ MÉTHODE MODIFIÉE - Statistiques avec paiements
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
          totalAmount: { $sum: '$totalPrice' },
          // ✅ NOUVEAU : Stats paiement
          totalPaid: { 
            $sum: { 
              $cond: [
                { $eq: ['$payment.status', 'succeeded'] }, 
                '$payment.amount', 
                0
              ] 
            } 
          }
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
          totalAmount: { $sum: '$totalPrice' },
          // ✅ NOUVEAU : Gains conductrice
          totalEarnings: { 
            $sum: { 
              $cond: [
                { $eq: ['$payment.status', 'succeeded'] }, 
                '$payment.commission.driverAmount',
                0
              ] 
            } 
          }
        }
      }
    ]);

    // ✅ NOUVEAU : Virements en attente
    const pendingPayouts = await Booking.find({
      driver: userId,
      'payment.driverPayout.status': { $in: ['pending', 'scheduled'] }
    }).select('payment.driverPayout trip numberOfSeats');

    // ✅ NOUVEAU : Remboursements récents
    const recentRefunds = await Booking.find({
      $or: [{ passenger: userId }, { driver: userId }],
      'payment.refundedAt': { $exists: true }
    })
    .sort({ 'payment.refundedAt': -1 })
    .limit(5)
    .select('payment trip numberOfSeats totalPrice');

    // Formater les statistiques
    const formatStats = (stats) => {
      const result = {};
      stats.forEach(stat => {
        result[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
          totalPaid: stat.totalPaid || 0,
          totalEarnings: stat.totalEarnings || 0
        };
      });
      return result;
    };

    res.status(200).json({
      success: true,
      stats: {
        asPassenger: formatStats(passengerStats),
        asDriver: formatStats(driverStats),
        // ✅ NOUVEAU : Infos paiements
        payments: {
          pendingPayouts: {
            count: pendingPayouts.length,
            totalAmount: pendingPayouts.reduce((sum, booking) => 
              sum + (booking.payment.driverPayout.amount || 0), 0
            ),
            bookings: pendingPayouts.map(booking => ({
              bookingId: booking._id,
              amount: booking.payment.driverPayout.amount,
              status: booking.payment.driverPayout.status,
              scheduledDate: booking.payment.driverPayout.scheduledDate,
              seats: booking.numberOfSeats
            }))
          },
          recentRefunds: recentRefunds.map(booking => ({
            bookingId: booking._id,
            refundAmount: booking.payment.refundAmount,
            refundedAt: booking.payment.refundedAt,
            originalAmount: booking.totalPrice,
            seats: booking.numberOfSeats
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking statistics'
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getUpcomingBookings,
  getPendingRequests,
  getBookingStats
};