const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

/**
 * @desc    Créer une nouvelle demande de réservation
 * @route   POST /api/bookings
 * @access  Privé
 */
const createBooking = async (req, res) => {
  try {
    const { tripId, numberOfSeats, message, customPickup, customDropoff } = req.body;
    const passengerId = req.user.id;

    const trip = await Trip.findById(tripId).populate('driver');
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    // Vérification de l'éligibilité de la conductrice (KYC)
    const driverKycStatus = trip.driver.getKycStatus();
    if (!driverKycStatus.canReceivePayments) {
      return res.status(400).json({
        success: false,
        message: 'Cette conductrice n\'est pas encore autorisée à recevoir des réservations',
        error: 'DRIVER_KYC_NOT_VERIFIED'
      });
    }

    // Vérification de la disponibilité du trajet
    if (!trip.canBeBookedBy(passengerId)) {
      return res.status(400).json({
        success: false,
        message: 'Ce trajet ne peut pas être réservé'
      });
    }

    if (numberOfSeats > trip.availableSeats) {
      return res.status(400).json({
        success: false,
        message: `Seulement ${trip.availableSeats} places disponibles`
      });
    }

    const totalPrice = trip.pricePerSeat * numberOfSeats;

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

    // Mise à jour immédiate des places pour bloquer la réservation
    trip.availableSeats = Math.max(0, trip.availableSeats - numberOfSeats);
    await trip.save();

    // Statistiques de demande
    await Trip.findByIdAndUpdate(tripId, {
      $inc: { 'stats.bookingRequests': 1 }
    });

    // Notification pour la conductrice
    await createNotification({
      recipient: trip.driver._id,
      sender: passengerId,
      type: 'new_booking',
      title: 'Nouvelle demande de réservation',
      message: `${req.user.displayName || 'Une passagère'} a demandé ${numberOfSeats} place(s) pour votre trajet ${trip.departure.city} → ${trip.arrival.city}.`,
      relatedId: booking._id.toString()
    });

    await booking.populate([
      { path: 'trip', select: 'departure arrival departureDateTime pricePerSeat distance' },
      { path: 'passenger', select: 'profile.displayName profile.avatar email' },
      { path: 'driver', select: 'profile.displayName profile.avatar email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Demande de réservation créée avec succès',
      booking
    });

  } catch (error) {
    console.error('Erreur lors de la création de la réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation'
    });
  }
};

/**
 * @desc    Obtenir toutes les réservations de l'utilisateur
 * @route   GET /api/bookings
 * @access  Privé
 */
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
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur récupération réservations'
    });
  }
};

/**
 * @desc    Confirmer une réservation (Conductrice seulement)
 * @route   PUT /api/bookings/:id/confirm
 * @access  Privé
 */
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'profile.displayName email')
      .populate('driver', 'profile.displayName email');

    if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });

    if (booking.driver._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Seule la conductrice peut confirmer' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Statut invalide pour confirmation' });
    }

    booking.status = 'confirmed';
    booking.confirmedAt = new Date();

    // Calcul de la date limite de paiement
    const deadlineHours = booking.trip.preferences?.paymentDeadlineHours || 24;
    const departureTime = new Date(booking.trip.departureDateTime).getTime();
    const now = new Date().getTime();

    let deadline = departureTime - (deadlineHours * 60 * 60 * 1000);
    if (deadline < now + (2 * 60 * 60 * 1000)) {
      deadline = now + (2 * 60 * 60 * 1000);
    }
    if (deadline > departureTime) deadline = departureTime;

    booking.paymentDeadline = new Date(deadline);
    await booking.save();

    // Mise à jour des statistiques passager
    await User.findByIdAndUpdate(booking.passenger._id, {
      $inc: { 'stats.tripsAsPassenger': 1 }
    });

    const deadlineStr = new Date(booking.paymentDeadline).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    await createNotification({
      recipient: booking.passenger._id,
      sender: req.user.id,
      type: 'booking_confirmed',
      title: 'Demande acceptée !',
      message: `Votre demande pour le trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city} a été acceptée. Payez avant le ${deadlineStr} pour confirmer votre place.`,
      relatedId: booking._id.toString()
    });

    res.status(200).json({
      success: true,
      message: 'Réservation confirmée avec succès',
      booking
    });

  } catch (error) {
    console.error('Erreur confirmation réservation:', error);
    res.status(500).json({ success: false, message: 'Erreur confirmation réservation' });
  }
};

/**
 * @desc    Annuler une réservation
 * @route   PUT /api/bookings/:id/cancel
 * @access  Privé
 */
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('trip');

    if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });

    if (booking.passenger.toString() !== req.user.id.toString() &&
        booking.driver.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    const initialStatus = booking.status;
    await booking.cancel(req.user.id, reason);

    const isDriver = req.user.id.toString() === booking.driver.toString();
    await createNotification({
      recipient: isDriver ? booking.passenger : booking.driver,
      sender: req.user.id,
      type: 'booking_cancelled',
      title: 'Réservation annulée',
      message: `La réservation pour le trajet ${booking.trip.departure.city} → ${booking.trip.arrival.city} a été annulée par la ${isDriver ? 'conductrice' : 'passagère'}.`,
      relatedId: booking._id.toString()
    });

    // Libérer les places si nécessaire
    if (['confirmed', 'pending', 'paid'].includes(initialStatus)) {
      const trip = await Trip.findById(booking.trip._id);
      if (trip) {
        trip.availableSeats += booking.numberOfSeats;
        await trip.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Réservation annulée avec succès'
    });

  } catch (error) {
    console.error('Erreur annulation réservation:', error);
    res.status(500).json({ success: false, message: 'Erreur annulation réservation' });
  }
};

/**
 * @desc    Ajouter une évaluation sur une réservation terminée
 * @route   POST /api/bookings/:id/review
 * @access  Privé (Passagère seulement)
 */
const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ success: false, message: 'Réservation non trouvée' });

    if (booking.passenger.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Seules les passagères peuvent laisser un avis' });
    }

    await booking.addReview(rating, comment);

    res.status(200).json({
      success: true,
      message: 'Avis ajouté avec succès',
      review: booking.review
    });

  } catch (error) {
    console.error('Erreur ajout avis:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur ajout avis' });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  confirmBooking,
  cancelBooking,
  addReview
};
