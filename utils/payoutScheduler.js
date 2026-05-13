const cron = require('node-cron');
const Booking = require('../models/Booking');

/**
 * Initialise le planificateur de virements automatiques
 * Exécution quotidienne pour traiter les virements dont l'échéance est atteinte
 */
const startPayoutScheduler = () => {
  // Planification quotidienne à 10h00
  cron.schedule('0 10 * * *', async () => {
    try {
      const now = new Date();
      
      // Recherche des réservations avec un virement programmé arrivant à échéance
      const scheduledPayouts = await Booking.find({
        'payment.driverPayout.status': 'scheduled',
        'payment.driverPayout.scheduledDate': { $lte: now }
      }).populate({
        path: 'trip',
        populate: { path: 'driver' }
      });
      
      for (const booking of scheduledPayouts) {
        try {
          await booking.executeScheduledPayout();
        } catch (error) {
          console.error(`Échec du virement pour la réservation ${booking._id}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Erreur du planificateur de virements:', error);
    }
  });
};

module.exports = { startPayoutScheduler };