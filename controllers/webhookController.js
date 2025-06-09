const stripeService = require('../services/stripeService');
const User = require('../models/User');

// @desc    Gérer les webhooks Stripe
// @route   POST /api/webhooks/stripe
// @access  Public (mais sécurisé par signature)
const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  try {
    // Vérifier la signature
    const event = stripeService.verifyWebhookSignature(
      req.body,
      signature
    );

    console.log(`🔔 Webhook reçu: ${event.type}`);

    // Traiter selon le type d'événement
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`⚠️ Événement non géré: ${event.type}`);
    }

    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook error'
    });
  }
};

// Fonctions de traitement des événements
async function handleCheckoutCompleted(session) {
  console.log('✅ Checkout complété:', session.id);
  
  const user = await User.findOne({
    'subscription.stripeCustomerId': session.customer
  });
  
  if (user) {
    user.subscription.isActive = true;
    user.subscription.status = 'active';
    user.subscription.plan = 'premium';
    await user.save();
    
    console.log(`✅ Utilisateur ${user.email} activé en Premium`);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('🆕 Abonnement créé:', subscription.id);
  
  const user = await User.findOne({
    'subscription.stripeCustomerId': subscription.customer
  });
  
  if (user) {
    user.subscription.stripeSubscriptionId = subscription.id;
    user.subscription.isActive = true;
    user.subscription.status = 'active';
    user.subscription.plan = 'premium';
    user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await user.save();
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Abonnement mis à jour:', subscription.id);
  
  const user = await User.findOne({
    'subscription.stripeSubscriptionId': subscription.id
  });
  
  if (user) {
    user.subscription.isActive = subscription.status === 'active';
    user.subscription.status = subscription.status;
    user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await user.save();
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Abonnement supprimé:', subscription.id);
  
  const user = await User.findOne({
    'subscription.stripeSubscriptionId': subscription.id
  });
  
  if (user) {
    user.subscription.isActive = false;
    user.subscription.status = 'cancelled';
    user.subscription.plan = 'free';
    await user.save();
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Paiement réussi:', invoice.id);
  // Logique supplémentaire si nécessaire
}

async function handlePaymentFailed(invoice) {
  console.log('💸 Paiement échoué:', invoice.id);
  // Logique de gestion des échecs de paiement
}

module.exports = {
  handleStripeWebhook
};