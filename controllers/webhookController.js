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

// @desc    Simuler un webhook de paiement réussi (DÉVELOPPEMENT UNIQUEMENT)
// @route   POST /api/webhooks/simulate-payment
// @access  Private (pour tests)
const simulatePayment = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Simulation not allowed in production'
      });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }

    console.log('🔍 Simulation pour userId:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ Utilisateur trouvé, état actuel:', {
      isActive: user.subscription?.isActive,
      plan: user.subscription?.plan,
      status: user.subscription?.status
    });

    // ✅ CORRECTION COMPLÈTE : Simuler un abonnement actif
    const simulatedSubscription = {
      isActive: true,
      plan: 'premium',
      status: 'active',
      stripeCustomerId: user.subscription?.stripeCustomerId || `cus_simulated_${Date.now()}`,
      stripeSubscriptionId: `sub_simulated_${Date.now()}`,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
      cancelAtPeriodEnd: false,
      lastPaymentStatus: 'succeeded'
    };

    // ✅ IMPORTANT : Utiliser findByIdAndUpdate pour être sûr de la sauvegarde
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          subscription: simulatedSubscription 
        }
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    console.log('✅ Utilisateur mis à jour:', {
      isActive: updatedUser.subscription.isActive,
      plan: updatedUser.subscription.plan,
      status: updatedUser.subscription.status
    });

    res.status(200).json({
      success: true,
      message: 'Payment simulated successfully',
      data: {
        userId: updatedUser._id,
        subscription: updatedUser.subscription
      }
    });

  } catch (error) {
    console.error('❌ Simulate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate payment',
      error: error.message
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
  handleStripeWebhook,
  simulatePayment
};