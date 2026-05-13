const mongoose = require('mongoose');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');

/**
 * Script de maintenance pour synchroniser les données Stripe et MongoDB
 * Utile pour restaurer des IDs manquants ou déclencher des remboursements en attente
 */
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connexion MongoDB établie');

    const payments = await stripe.paymentIntents.list({ limit: 100 });
    const withBooking = payments.data.filter(p => p.metadata.bookingId);

    let updatedCount = 0;
    let refundTriggeredCount = 0;

    for (const payment of withBooking) {
      const bookingId = payment.metadata.bookingId;
      const booking = await Booking.findById(bookingId);

      if (!booking) continue;

      // Restauration de l'ID de paiement s'il est manquant en base
      if (!booking.payment.stripePaymentIntentId) {
        booking.payment.stripePaymentIntentId = payment.id;
        updatedCount++;
      }

      // Traitement des remboursements orphelins (booking annulé mais non remboursé sur Stripe)
      if (booking.status === 'cancelled' && booking.payment.status === 'refunded' && payment.amount_received > 0) {
        const refunds = await stripe.refunds.list({ payment_intent: payment.id });
        if (refunds.data.length === 0) {
          try {
            await booking.processRefund(1.0);
            refundTriggeredCount++;
          } catch (err) {
            console.error(`Échec du remboursement pour ${bookingId}:`, err.message);
          }
        }
      }

      await booking.save();
    }

    console.log('Bilan de la maintenance :');
    console.log(`- IDs Stripe restaurés : ${updatedCount}`);
    console.log(`- Remboursements Stripe déclenchés : ${refundTriggeredCount}`);

    process.exit(0);

  } catch (error) {
    console.error('Erreur lors de la maintenance :', error);
    process.exit(1);
  }
})();
