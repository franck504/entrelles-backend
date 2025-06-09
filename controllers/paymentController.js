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

    // ✅ Gérer le cas où le portail n'est pas disponible
    if (!portal.url) {
      return res.status(400).json({
        success: false,
        message: portal.message,
        configUrl: portal.configUrl
      });
    }

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

// @desc    Obtenir le statut de l'abonnement
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

    // ✅ AMÉLIORATION : Vérifier d'abord la base de données locale
    let subscriptionData = {
      hasActiveSubscription: user.subscription?.isActive || false,
      status: user.subscription?.status || 'inactive',
      plan: user.subscription?.plan || 'free',
      currentPeriodStart: user.subscription?.currentPeriodStart || null,
      currentPeriodEnd: user.subscription?.currentPeriodEnd || null,
      cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd || false,
      stripeCustomerId: user.subscription?.stripeCustomerId || null,
      stripeSubscriptionId: user.subscription?.stripeSubscriptionId || null
    };

    // Si on a un customer ID Stripe, vérifier avec Stripe
    if (user.subscription?.stripeCustomerId) {
      try {
        const stripeStatus = await stripeService.getSubscriptionStatus(
          user.subscription.stripeCustomerId
        );
        
        // Mettre à jour avec les données Stripe si différentes
        if (stripeStatus.hasActiveSubscription !== subscriptionData.hasActiveSubscription) {
          subscriptionData = {
            ...subscriptionData,
            ...stripeStatus,
            plan: stripeStatus.hasActiveSubscription ? 'premium' : 'free'
          };
          
          const validStatus = stripeStatus.status === 'none' ? 'inactive' : stripeStatus.status;
          
          // Mettre à jour la base de données
          user.subscription = {
            ...user.subscription,
            isActive: stripeStatus.hasActiveSubscription,
            status: validStatus,
            plan: stripeStatus.hasActiveSubscription ? 'premium' : 'free',
            currentPeriodStart: stripeStatus.currentPeriodStart,
            currentPeriodEnd: stripeStatus.currentPeriodEnd,
            cancelAtPeriodEnd: stripeStatus.cancelAtPeriodEnd
          };
          await user.save();
        }
      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError);
        // Continuer avec les données locales en cas d'erreur Stripe
      }
    }

    res.status(200).json({
      success: true,
      data: subscriptionData
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status'
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
    if (!user || !user.subscription.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // ✅ AMÉLIORATION : Récupérer l'ID d'abonnement depuis Stripe
    const subscriptionStatus = await stripeService.getSubscriptionStatus(
      user.subscription.stripeCustomerId
    );

    if (!subscriptionStatus.hasActiveSubscription || !subscriptionStatus.subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    const result = await stripeService.cancelSubscription(
      subscriptionStatus.subscriptionId
    );

    // Mettre à jour la base de données
    user.subscription.cancelAtPeriodEnd = true;
    user.subscription.stripeSubscriptionId = subscriptionStatus.subscriptionId;
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

// @desc    Réactiver l'abonnement
// @route   POST /api/payments/reactivate-subscription
// @access  Private
const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user || !user.subscription.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // Récupérer l'ID d'abonnement depuis Stripe
    const subscriptionStatus = await stripeService.getSubscriptionStatus(
      user.subscription.stripeCustomerId
    );

    if (!subscriptionStatus.subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription to reactivate'
      });
    }

    const result = await stripeService.reactivateSubscription(
      subscriptionStatus.subscriptionId
    );

    // Mettre à jour la base de données
    user.subscription.cancelAtPeriodEnd = false;
    user.subscription.isActive = true;
    user.subscription.status = 'active';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: {
        reactivated: result.reactivated,
        status: result.status,
        currentPeriodEnd: result.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reactivate subscription'
    });
  }
};

module.exports = {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription
};