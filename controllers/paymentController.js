const User = require('../models/User');
const stripeService = require('../services/stripeService');

// @desc    Créer une session de checkout
// @route   POST /api/payments/create-checkout
// @access  Private
const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
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

// @desc    Vérifier une session checkout
// @route   GET /api/payments/verify-checkout?sessionId=cs_xxx
// @access  Public
const verifyCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID required'
      });
    }

    console.log('🔍 Vérification session:', sessionId);

    // Utiliser l'instance Stripe du service
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    console.log('📊 Session Stripe:', {
      id: session.id,
      payment_status: session.payment_status,
      customer: session.customer?.id || session.customer
    });

    if (session.payment_status === 'paid') {
      // Trouver l'utilisateur par customer ID
      const customerId = typeof session.customer === 'string' 
        ? session.customer 
        : session.customer?.id;

      const user = await User.findOne({
        'subscription.stripeCustomerId': customerId
      });

      if (user) {
        console.log('👤 Utilisateur trouvé:', user.email);

        // Activer l'abonnement
        user.subscription = {
          ...user.subscription,
          isActive: true,
          status: 'active',
          plan: 'premium',
          stripeSubscriptionId: session.subscription?.id || session.subscription,
          currentPeriodStart: session.subscription ? 
            new Date(session.subscription.current_period_start * 1000) : new Date(),
          currentPeriodEnd: session.subscription ? 
            new Date(session.subscription.current_period_end * 1000) : 
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastPaymentStatus: 'succeeded'
        };
        
        await user.save();
        console.log('✅ Abonnement activé pour:', user.email);

        res.status(200).json({
          success: true,
          message: 'Payment verified and subscription activated',
          data: {
            paymentStatus: session.payment_status,
            subscriptionStatus: 'active',
            userId: user._id,
            email: user.email
          }
        });
      } else {
        console.log('⚠️ Utilisateur non trouvé pour customer:', customerId);
        res.status(404).json({
          success: false,
          message: 'User not found for this payment'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed',
        data: {
          paymentStatus: session.payment_status,
          sessionId: sessionId
        }
      });
    }

  } catch (error) {
    console.error('❌ Verify checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify checkout session',
      error: error.message
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
    
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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
    if (user.subscription?.stripeCustomerId && !user.subscription?.isActive) {
      try {
        const stripeStatus = await stripeService.getSubscriptionStatus(
          user.subscription.stripeCustomerId
        );
        
        if (stripeStatus.hasActiveSubscription !== subscriptionData.hasActiveSubscription) {
          subscriptionData = {
            ...subscriptionData,
            ...stripeStatus,
            plan: stripeStatus.hasActiveSubscription ? 'premium' : 'free'
          };
          
          const validStatus = stripeStatus.status === 'none' ? 'inactive' : stripeStatus.status;
          
          await User.findByIdAndUpdate(userId, {
            $set: {
              'subscription.isActive': stripeStatus.hasActiveSubscription,
              'subscription.status': validStatus,
              'subscription.plan': stripeStatus.hasActiveSubscription ? 'premium' : 'free',
              'subscription.currentPeriodStart': stripeStatus.currentPeriodStart,
              'subscription.currentPeriodEnd': stripeStatus.currentPeriodEnd,
              'subscription.cancelAtPeriodEnd': stripeStatus.cancelAtPeriodEnd
            }
          });
        }
      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError.message);
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

module.exports = {
  createCheckoutSession,
  verifyCheckoutSession,
  createPortalSession,
  getSubscriptionStatus
};