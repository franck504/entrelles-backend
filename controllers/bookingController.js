const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc    Créer une nouvelle réservation
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const { tripId, numberOfSeats, message, customPickup, customDropoff } = req.body;
    const passengerId = req.user.id;

    console.log('🎫 Creating booking for trip:', tripId);

    // Récupérer le trajet avec la conductrice
    const trip = await Trip.findById(tripId).populate('driver');
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // ✅ VÉRIFIER KYC DE LA CONDUCTRICE
    const driverKycStatus = trip.driver.getKycStatus();

    if (!driverKycStatus.canReceivePayments) {
      return res.status(400).json({
        success: false,
        message: 'Cette conductrice ne peut pas encore recevoir de réservations',
        error: 'DRIVER_KYC_NOT_VERIFIED',
        kyc: {
          status: driverKycStatus.status,
          message: 'La conductrice doit compléter sa vérification d\'identité'
        },
        action: {
          type: 'info',
          title: 'Conductrice non vérifiée',
          description: 'Cette conductrice n\'a pas encore complété sa vérification d\'identité',
          buttonText: 'Choisir un autre trajet'
        }
      });
    }

    // Vérifier que le trajet peut être réservé
    if (!trip.canBeBookedBy(passengerId)) {
      return res.status(400).json({
        success: false,
        message: 'This trip cannot be booked'
      });
    }

    // Vérifier le nombre de places disponibles
    if (numberOfSeats > trip.availableSeats) {
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
      passenger: passengerId,
      driver: trip.driver._id,
      numberOfSeats,
      totalPrice,
      message,
      customPickup,
      customDropoff,
      status: 'pending'
    });

    // ✅ AJOUT: Incrémenter les stats de demandes du trajet
    await Trip.findByIdAndUpdate(tripId, {
      $inc: { 'stats.bookingRequests': 1 }
    });

    // ✅ AJOUT: Notification pour la conductrice
    await createNotification({
      recipient: trip.driver._id,
      sender: passengerId,
      type: 'new_booking',
      title: 'Nouvelle demande de réservation',
      message: `${req.user.displayName || 'Une passagère'} a demandé ${numberOfSeats} place(s) pour votre trajet ${trip.departure.city} → ${trip.arrival.city}.`,
      relatedId: booking._id.toString()
    });

    // Populer les données pour la réponse
    await booking.populate([
      { path: 'trip', select: 'departure arrival departureDateTime pricePerSeat distance' },
      { path: 'passenger', select: 'profile.displayName profile.avatar email' },
      { path: 'driver', select: 'profile.displayName profile.avatar email' }
    ]);

    console.log('✅ Booking created successfully:', booking._id);

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      booking: {
        id: booking._id,
        trip: {
          id: booking.trip._id,
          route: `${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
          departureDateTime: booking.trip.departureDateTime,
          distance: booking.trip.distance
        },
        passenger: {
          id: booking.passenger._id,
          name: booking.passenger.profile.displayName,
          email: booking.passenger.email
        },
        driver: {
          id: booking.driver._id,
          name: booking.driver.profile.displayName,
          email: booking.driver.email
        },
        numberOfSeats: booking.numberOfSeats,
        totalPrice: booking.totalPrice,
        status: booking.status,
        requestedAt: booking.requestedAt
      }
    });

  } catch (error) {
    console.error('❌ Create booking error:', error);

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
      message: 'Error creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Obtenir toutes les réservations
// @route   GET /api/bookings
// @access  Private
const getAllBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookings = await Booking.getBookingsByUser(userId);

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('❌ Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
};

// @desc    Obtenir une réservation par ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'profile.displayName profile.avatar email')
      .populate('driver', 'profile.displayName profile.avatar email');

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

    res.status(200).json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('❌ Get booking error:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching booking'
    });
  }
};

// @desc    Confirmer une réservation (conductrice)
// @route   PUT /api/bookings/:id/confirm
// @access  Private
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'profile.displayName email')
      .populate('driver', 'profile.displayName email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Vérifier que l'utilisateur est la conductrice
    if (booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can confirm bookings'
      });
    }

    // Vérifier le statut
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm booking with status: ${booking.status}`
      });
    }

    // Confirmer la réservation
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    await booking.save();

    // ✅ AJOUT: Incrémenter stats passager (tripsAsPassenger)
    await User.findByIdAndUpdate(booking.passenger._id, {
      $inc: { 'stats.tripsAsPassenger': 1 }
    });

    // ✅ AJOUT: Notification pour la passagère
    await createNotification({
      recipient: booking.passenger._id,
      sender: req.user.id,
      type: 'booking_confirmed',
      title: 'Réservation confirmée !',
      message: `Votre demande pour le trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city} a été acceptée par ${booking.driver.profile.displayName}.`,
      relatedId: booking._id.toString()
    });
    console.log('✅ Stats passager mises à jour: tripsAsPassenger +1');

    // Mettre à jour les places disponibles
    const trip = await Trip.findById(booking.trip._id);
    if (trip) {
      trip.availableSeats = Math.max(0, trip.availableSeats - booking.numberOfSeats);
      await trip.save();
    }

    console.log('✅ Booking confirmed:', booking._id);

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        trip: {
          route: `${booking.trip.departure.city} → ${booking.trip.arrival.city}`,
          date: booking.trip.departureDateTime
        },
        passenger: {
          name: booking.passenger.profile.displayName,
          email: booking.passenger.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking'
    });
  }
};

// @desc    Annuler une réservation
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'profile.displayName email')
      .populate('driver', 'profile.displayName email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Vérifier que l'utilisateur peut annuler
    if (booking.passenger._id.toString() !== req.user.id.toString() &&
      booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Annuler la réservation
    await booking.cancel(req.user.id, reason);

    // ✅ AJOUT: Notification
    const isDriver = req.user.id.toString() === booking.driver._id.toString();
    await createNotification({
      recipient: isDriver ? booking.passenger._id : booking.driver._id,
      sender: req.user.id,
      type: 'booking_cancelled',
      title: 'Réservation annulée',
      message: `La réservation pour le trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city} a été annulée par ${isDriver ? 'la conductrice' : 'la passagère'}.`,
      relatedId: booking._id.toString()
    });

    // Remettre les places disponibles si c'était confirmé
    if (booking.status === 'confirmed') {
      const trip = await Trip.findById(booking.trip._id);
      if (trip) {
        trip.availableSeats += booking.numberOfSeats;
        await trip.save();
      }
    }

    console.log('✅ Booking cancelled:', booking._id);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: 'cancelled',
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason
      }
    });

  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking'
    });
  }
};

// @desc    Marquer une réservation comme terminée
// @route   PUT /api/bookings/:id/complete
// @access  Private
const completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'profile.displayName')
      .populate('driver', 'profile.displayName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Vérifier que l'utilisateur est impliqué
    if (booking.passenger._id.toString() !== req.user.id.toString() &&
      booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this booking'
      });
    }

    // Marquer comme terminé
    await booking.complete();

    // ✅ AJOUT: Incrémenter stats passager et conductrice (tripsCompleted)
    await User.findByIdAndUpdate(booking.passenger._id, {
      $inc: { 'stats.tripsCompleted': 1 }
    });

    await User.findByIdAndUpdate(booking.driver._id, {
      $inc: { 'stats.tripsCompleted': 1 }
    });
    console.log('✅ Stats tripsCompleted mises à jour pour passager et conductrice');

    console.log('✅ Booking completed:', booking._id);

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        completedAt: booking.completedAt
      }
    });

  } catch (error) {
    console.error('❌ Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing booking'
    });
  }
};

// @desc    Ajouter une évaluation
// @route   POST /api/bookings/:id/review
// @access  Private
const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('driver', 'profile.displayName stats.rating stats.ratingsCount');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Vérifier que l'utilisateur est la passagère
    if (booking.passenger.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only passengers can leave reviews'
      });
    }

    // Ajouter l'évaluation
    await booking.addReview(rating, comment);

    console.log('✅ Review added for booking:', booking._id);

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      review: {
        rating: booking.review.rating,
        comment: booking.review.comment,
        reviewedAt: booking.review.reviewedAt
      }
    });

  } catch (error) {
    console.error('❌ Add review error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding review'
    });
  }
};

// @desc    Obtenir mes réservations
// @route   GET /api/bookings/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, type } = req.query;

    let bookings;

    if (type === 'passenger') {
      bookings = await Booking.find({ passenger: userId })
        .populate('trip', 'departure arrival departureDateTime distance')
        .populate('driver', 'profile.displayName profile.avatar stats.rating')
        .sort({ requestedAt: -1 });
    } else if (type === 'driver') {
      bookings = await Booking.find({ driver: userId })
        .populate('trip', 'departure arrival departureDateTime distance')
        .populate('passenger', 'profile.displayName profile.avatar')
        .sort({ requestedAt: -1 });
    } else {
      bookings = await Booking.getBookingsByUser(userId);
    }

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('❌ Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
};

// @desc    Supprimer toutes les réservations (DEV/ADMIN)
// @route   DELETE /api/bookings/delete-all
// @access  Private
const deleteAllBookings = async (req, res) => {
  try {
    await Booking.deleteMany({});
    console.log('🗑️ Toutes les réservations ont été supprimées');
    res.status(200).json({
      success: true,
      message: 'Toutes les réservations ont été supprimées'
    });
  } catch (error) {
    console.error('❌ Erreur suppression réservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des réservations'
    });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addReview,
  getMyBookings,
  deleteAllBookings
};
