const cron = require('node-cron');
const Booking = require('../models/Booking');

// ✅ CRON JOB - Exécuter les virements programmés
const startPayoutScheduler = () => {
  // Tous les jours à 10h00
  cron.schedule('0 10 * * *', async () => {
    console.log('🔄 Checking scheduled payouts...');
    
    try {
      const now = new Date();
      
      // Trouver les virements à exécuter
      const scheduledPayouts = await Booking.find({
        'payment.driverPayout.status': 'scheduled',
        'payment.driverPayout.scheduledDate': { $lte: now }
      }).populate({
        path: 'trip',
        populate: { path: 'driver' }
      });
      
      console.log(`📋 Found ${scheduledPayouts.length} payouts to execute`);
      
      for (const booking of scheduledPayouts) {
        try {
          await booking.executeScheduledPayout();
          console.log(`✅ Payout executed for booking: ${booking._id}`);
        } catch (error) {
          console.error(`❌ Payout failed for booking ${booking._id}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Payout scheduler error:', error);
    }
  });
  
  console.log('✅ Payout scheduler started');
};

module.exports = { startPayoutScheduler };