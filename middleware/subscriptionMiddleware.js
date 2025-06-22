const requireActiveSubscription = async (req, res, next) => {
  try {
    const User = require('../models/User');
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
        },
        action: {
          type: 'subscription_required',
          title: 'Abonnement requis',
          description: 'Cette fonctionnalité nécessite un abonnement premium actif',
          buttonText: 'S\'abonner maintenant',
          redirectTo: '/subscription/plans'
        }
      });
    }
    
    console.log('✅ Abonnement vérifié pour utilisateur:', user.email);
    next();
    
  } catch (error) {
    console.error('❌ Erreur vérification abonnement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'abonnement'
    });
  }
};

module.exports = {
  requireActiveSubscription
};