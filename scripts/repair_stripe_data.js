const mongoose = require('mongoose');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('./models/Booking');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connecté');

        console.log('📥 Récupération des transactions depuis Stripe...');
        const payments = await stripe.paymentIntents.list({ limit: 100 });
        const withBooking = payments.data.filter(p => p.metadata.bookingId);

        console.log(`📊 ${withBooking.length} transactions Stripe avec bookingId trouvées.`);

        let updatedCount = 0;
        let refundTriggeredCount = 0;

        for (const payment of withBooking) {
            const bookingId = payment.metadata.bookingId;
            const booking = await Booking.findById(bookingId);

            if (!booking) {
                console.warn(`⚠️  Booking ${bookingId} non trouvé en base (Trajet peut-être supprimé?)`);
                continue;
            }

            // 1. Restaurer l'ID Stripe s'il manque
            if (!booking.payment.stripePaymentIntentId) {
                booking.payment.stripePaymentIntentId = payment.id;
                console.log(`✅ ID restauré pour Booking ${bookingId} -> ${payment.id}`);
                updatedCount++;
            }

            // 2. Si le booking avait été "annulé" mais sans remboursement Stripe (à cause du bug)
            // On détecte cela si pStatus est 'refunded' mais stripe.amount_refunded est 0 (ou pas de Refund object lié)
            if (booking.status === 'cancelled' && booking.payment.status === 'refunded' && payment.amount_received > 0) {

                // Vérifier si un remboursement existe déjà dans Stripe
                const refunds = await stripe.refunds.list({ payment_intent: payment.id });
                if (refunds.data.length === 0) {
                    console.log(`💰 Déclenchement du remboursement Stripe MANQUANT pour Booking ${bookingId}...`);

                    try {
                        // On relance le processRefund (qui maintenant a l'ID et fonctionnera)
                        // Note: On suppose ici 100% car ce sont des annulations conductrices bloquées
                        await booking.processRefund(1.0);
                        console.log(`✨ Remboursement Stripe 100% EFFECTUÉ pour ${bookingId}`);
                        refundTriggeredCount++;
                    } catch (err) {
                        console.error(`❌ Échec du remboursement pour ${bookingId}:`, err.message);
                    }
                } else {
                    console.log(`ℹ️ Booking ${bookingId} est déjà remboursé dans Stripe.`);
                }
            }

            await booking.save();
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`📈 BILAN RÉPARATION :`);
        console.log(`   - IDs Stripe restaurés : ${updatedCount}`);
        console.log(`   - Remboursements Stripe déclenchés : ${refundTriggeredCount}`);
        console.log('═══════════════════════════════════════════════════════════════');

        process.exit(0);

    } catch (error) {
        console.error('❌ ERREUR FATALE:', error);
        process.exit(1);
    }
})();
