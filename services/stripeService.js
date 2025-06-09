const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  
  // Créer un client Stripe
  async createCustomer(user) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.displayName,
        metadata: {
          userId: user._id.toString(),
          registrationDate: user.createdAt.toISOString()
        }
      });
      
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Créer une session de checkout (sans redirection)
  async createCheckoutSession(customerId, priceId) {
    try {
      // ✅ VÉRIFICATION : Tester si le prix existe
      let validPriceId = priceId;
      
      try {
        await stripe.prices.retrieve(priceId);
        console.log('✅ Prix existant trouvé:', priceId);
      } catch (priceError) {
        console.log('⚠️ Prix non trouvé, création automatique...');
        
        // Créer un produit et prix automatiquement
        const product = await stripe.products.create({
          name: 'Entrelles Premium',
          description: 'Abonnement premium Entrelles'
        });
        
        const price = await stripe.prices.create({
          unit_amount: 999, // 9.99€
          currency: 'eur',
          recurring: { interval: 'month' },
          product: product.id
        });
        
        validPriceId = price.id;
        console.log('✅ Nouveau prix créé:', validPriceId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: validPriceId, // Utiliser le prix valide
            quantity: 1,
          },
        ],
        mode: 'subscription',
        // ✅ Pas d'URLs de redirection - retour JSON
        success_url: 'https://dummy.com/success',
        cancel_url: 'https://dummy.com/cancel',
        metadata: {
          customerId: customerId
        }
      });

      return {
        sessionId: session.id,
        url: session.url,
        customerId: customerId,
        priceId: validPriceId // Retourner le prix utilisé
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // ✅ AMÉLIORATION : Créer un portail client avec gestion d'erreur
  async createPortalSession(customerId) {
    try {
      // Vérifier d'abord si le customer existe et a des abonnements
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Vérifier s'il y a des abonnements
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        console.log('⚠️ Aucun abonnement trouvé pour ce client');
        return {
          url: null,
          message: 'No active subscription found. Customer portal not available.'
        };
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: process.env.FRONTEND_URL || 'https://entrelles.vercel.app/dashboard',
      });

      return {
        url: session.url,
        message: 'Portal session created successfully'
      };
    } catch (error) {
      console.error('Error creating portal session:', error);
      
      // ✅ Gestion spécifique des erreurs de configuration
      if (error.message.includes('configuration')) {
        return {
          url: null,
          message: 'Customer portal not configured. Please set up billing portal in Stripe Dashboard.',
          configUrl: 'https://dashboard.stripe.com/test/settings/billing/portal'
        };
      }
      
      throw new Error('Failed to create portal session');
    }
  }

  // Récupérer les informations d'abonnement
  async getSubscriptionStatus(customerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return {
          hasActiveSubscription: false,
          status: 'none',
          currentPeriodEnd: null
        };
      }

      const subscription = subscriptions.data[0];
      
      return {
        hasActiveSubscription: subscription.status === 'active',
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        subscriptionId: subscription.id
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw new Error('Failed to get subscription status');
    }
  }

  // Annuler un abonnement (en fin de période)
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      return {
        cancelled: true,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Réactiver un abonnement annulé
  async reactivateSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });

      return {
        reactivated: true,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw new Error('Failed to reactivate subscription');
    }
  }

  // Vérifier la signature du webhook
  verifyWebhookSignature(payload, signature) {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

module.exports = new StripeService();