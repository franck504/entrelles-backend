const User = require('../models/User');
const stripeService = require('../services/stripeService');

// @desc    Créer une session de checkout
// @route   POST /api/payments/create-checkout
// @access  Private
const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    let customerId = user.subscription.stripeCustomerId;

    // Créer un client Stripe si nécessaire
    if (!customerId) {
      const customer = await stripeService.createCustomer(user);
      customerId = customer.id;
      
      // Sauvegarder l'ID client
      user.subscription.stripeCustomerId = customerId;
      await user.save();
    }

    // Créer la session de checkout
    const session = await stripeService.createCheckoutSession(
      customerId,
      process.env.STRIPE_PRICE_ID
    );

    res.status(200).json({
      success: true,
      message: 'Checkout session created',
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.url,
        customerId: session.customerId
      }
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create checkout session'
    });
  }
};

// @desc    Créer une session portail client
// @route   POST /api/payments/create-portal
// @access  Private
const createPortalSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.subscription.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found'
      });
    }

    const portal = await stripeService.createPortalSession(
      user.subscription.stripeCustomerId
    );

    res.status(200).json({
      success: true,
      message: 'Portal session created',
      data: {
        portalUrl: portal.url
      }
    });

  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create portal session'
    });
  }
};

// @desc    Obtenir le statut d'abonnement
// @route   GET /api/payments/subscription-status
// @access  Private
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Si pas de client Stripe, pas d'abonnement
    if (!user.subscription.stripeCustomerId) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveSubscription: false,
          status: 'none',
          plan: 'free'
        }
      });
    }

    // Récupérer le statut depuis Stripe
    const subscriptionStatus = await stripeService.getSubscriptionStatus(
      user.subscription.stripeCustomerId
    );

    // Mettre à jour la base de données
    user.subscription.isActive = subscriptionStatus.hasActiveSubscription;
    user.subscription.status = subscriptionStatus.hasActiveSubscription ? 'active' : 'inactive';
    user.subscription.plan = subscriptionStatus.hasActiveSubscription ? 'premium' : 'free';
    
    if (subscriptionStatus.currentPeriodEnd) {
      user.subscription.currentPeriodEnd = subscriptionStatus.currentPeriodEnd;
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: subscriptionStatus.hasActiveSubscription,
        status: subscriptionStatus.status,
        plan: user.subscription.plan,
        currentPeriodEnd: subscriptionStatus.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptionStatus.cancelAtPeriodEnd
      }
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get subscription status'
    });
  }
};

// @desc    Annuler l'abonnement
// @route   POST /api/payments/cancel-subscription
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user || !user.subscription.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    const result = await stripeService.cancelSubscription(
      user.subscription.stripeSubscriptionId
    );

    // Mettre à jour la base de données
    user.subscription.cancelAtPeriodEnd = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      data: {
        cancelled: result.cancelled,
        currentPeriodEnd: result.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel subscription'
    });
  }
};

module.exports = {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  cancelSubscription
};