const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
};

const activateSubscription = async (userId, subscriptionId) => {
  const User = require('./models/User');
  
  const user = await User.findByIdAndUpdate(userId, {
    'subscription.stripeSubscriptionId': subscriptionId || 'manual_activation',
    'subscription.status': 'active',
    'subscription.plan': 'premium',
    'subscription.isActive': true,
    'subscription.currentPeriodStart': new Date(),
    'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    'subscription.activatedAt': new Date(),
    'subscription.activatedVia': 'manual'
  }, { new: true });
  
  return user;
};

// Exécution
connectDB().then(async () => {
  const userId = process.argv[2] || '694fdfd7ad58485e8f4cb103';
  const subscriptionId = process.argv[3];
  
  console.log('🔧 Activating subscription for user:', userId);
  
  const user = await activateSubscription(userId, subscriptionId);
  
  if (user) {
    console.log('✅ Subscription activated!');
    console.log({
      email: user.email,
      plan: user.subscription.plan,
      isActive: user.subscription.isActive,
      status: user.subscription.status
    });
  } else {
    console.log('❌ User not found');
  }
  
  process.exit(0);
});
