const User = require('../models/User');

/**
 * Middleware exigeant un abonnement premium actif pour accéder à la route
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    if (!user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: 'Abonnement premium requis',
        error: 'SUBSCRIPTION_REQUIRED',
        subscription: {
          status: user.getSubscriptionStatus(),
          plan: user.subscription.plan,
          isActive: user.subscription.isActive
        }
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur vérification abonnement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification de l\'abonnement'
    });
  }
};

module.exports = {
  requireActiveSubscription
};