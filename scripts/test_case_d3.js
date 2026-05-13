const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Trip = require('./models/Trip');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification');

const tripId = '6964d3b30e1eb7e61c8ec057';
const userId = '6962c75d33201a5344478198'; // Gracia
const reason = 'Test CAS D3 - Problème de santé';

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connecté');

        // Récupérer le trajet
        const trip = await Trip.findById(tripId);
        if (!trip) {
            console.error('❌ Trajet non trouvé');
            process.exit(1);
        }

        console.log('📍 Trajet:', trip.departure.city, '→', trip.arrival.city);
        console.log('👤 Conducteur:', trip.driver.toString());
        console.log('🔐 User ID:', userId);

        // Vérifier les réservations
        const bookings = await Booking.find({
            trip: tripId,
            status: { $in: ['confirmed', 'paid', 'pending'] }
        });

        console.log(`\n📊 Réservations trouvées: ${bookings.length}`);

        for (const booking of bookings) {
            console.log(`\n🎫 Réservation ${booking._id}`);
            console.log('   Status:', booking.status);
            console.log('   Payment Status:', booking.payment?.status);
            console.log('   Payment Intent:', booking.payment?.stripePaymentIntentId);
            console.log('   Montant:', booking.payment?.amount / 100, '€');

            // Tester l'annulation
            console.log('\n🔄 Tentative d\'annulation...');

            try {
                await booking.cancel(userId, `Trajet annulé par la conductrice: ${reason}`);
                console.log('✅ Réservation annulée avec succès');
            } catch (error) {
                console.error('❌ Erreur lors de l\'annulation:', error.message);
                console.error('Stack:', error.stack);
            }

            // Créer notification
            try {
                if (booking.passenger) {
                    await Notification.create({
                        recipient: booking.passenger._id,
                        type: 'trip_cancelled',
                        title: 'Trajet annulé',
                        message: `Le trajet ${trip.departure.city} → ${trip.arrival.city} a été annulé. Raison: ${reason}`,
                        relatedId: trip._id.toString(),
                        data: { tripId: trip._id, bookingId: booking._id, reason }
                    });
                    console.log('✅ Notification créée');
                }
            } catch (error) {
                console.error('❌ Erreur notification:', error.message);
            }
        }

        // Marquer le trajet comme annulé
        trip.status = 'cancelled';
        trip.cancellationReason = reason;
        trip.cancelledAt = new Date();
        await trip.save();
        console.log('\n✅ Trajet marqué comme annulé');

        console.log('\n🏁 TEST TERMINÉ');
        process.exit(0);

    } catch (error) {
        console.error('❌ ERREUR GLOBALE:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
})();
