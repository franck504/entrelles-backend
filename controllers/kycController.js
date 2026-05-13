const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

/**
 * @desc    Obtenir le statut KYC de l'utilisateur
 * @route   GET /api/kyc/status
 * @access  Privé
 */
const getKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    let kycData = {
      hasConnectAccount: false,
      status: 'not_started',
      canReceivePayments: false,
      requiresOnboarding: false,
      connectAccountId: null,
      message: 'Vérification KYC non démarrée'
    };

    if (user.kyc?.stripeConnectAccountId) {
      try {
        const account = await stripe.accounts.retrieve(user.kyc.stripeConnectAccountId);

        kycData = {
          hasConnectAccount: true,
          status: account.details_submitted ?
            (account.charges_enabled && account.payouts_enabled ? 'verified' : 'pending') :
            'incomplete',
          canReceivePayments: account.charges_enabled && account.payouts_enabled,
          requiresOnboarding: !account.details_submitted,
          connectAccountId: account.id,
          message: account.charges_enabled && account.payouts_enabled ?
            'Compte vérifié et opérationnel' :
            'Vérification en cours ou incomplète'
        };

        user.kyc.status = kycData.status;
        user.kyc.canReceivePayments = kycData.canReceivePayments;
        user.kyc.lastChecked = new Date();
        await user.save();

      } catch (stripeError) {
        console.error('Erreur récupération compte Stripe Connect:', stripeError);
        kycData.message = 'Erreur lors de la vérification du compte';
      }
    }

    res.status(200).json({ success: true, kyc: kycData });

  } catch (error) {
    console.error('Erreur statut KYC:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du statut KYC' });
  }
};

/**
 * @desc    Démarrer le processus KYC (Création de compte Connect et lien d'onboarding)
 * @route   POST /api/kyc/start
 * @access  Privé
 */
const startKycProcess = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    let accountId = user.kyc?.stripeConnectAccountId;

    // Si pas de compte, on en crée un
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        individual: {
          email: user.email,
          first_name: user.profile.firstName || user.profile.displayName?.split(' ')[0],
          last_name: user.profile.lastName || user.profile.displayName?.split(' ')[1] || ''
        },
        metadata: { userId: userId.toString(), platform: 'entrelles' }
      });
      accountId = account.id;

      user.kyc = user.kyc || {};
      user.kyc.stripeConnectAccountId = accountId;
      user.kyc.status = 'pending';
      user.kyc.accountType = 'express';
      user.kyc.createdAt = new Date();
      user.kyc.lastChecked = new Date();
      user.kyc.requiresOnboarding = true;
      user.kyc.canReceivePayments = false;
      await user.save();
    }

    // Création du lien d'onboarding
    const baseUrl = process.env.FRONTEND_URL || 'https://entrelles-backend.vercel.app';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/kyc/cancel?user_id=${userId}`,
      return_url: `${baseUrl}/api/kyc/success?user_id=${userId}`,
      type: 'account_onboarding'
    });

    res.status(201).json({
      success: true,
      accountId,
      onboarding: {
        url: accountLink.url,
        expires_at: accountLink.expires_at
      }
    });

  } catch (error) {
    console.error('Erreur démarrage processus KYC:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du démarrage du processus KYC' });
  }
};

/**
 * @desc    Créer un lien d'onboarding pour un compte existant
 * @route   POST /api/kyc/create-onboarding-link
 * @access  Privé
 */
const createOnboardingLink = async (req, res) => {
  try {
    const { accountId, returnUrl, refreshUrl } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.kyc?.stripeConnectAccountId !== accountId) {
      return res.status(403).json({ success: false, message: 'Compte non trouvé ou non autorisé' });
    }

    const validReturnUrl = returnUrl && (returnUrl.startsWith('https://') || returnUrl.startsWith('entrelles://'))
      ? returnUrl : 'entrelles://kyc-success';

    const validRefreshUrl = refreshUrl && (refreshUrl.startsWith('https://') || refreshUrl.startsWith('entrelles://'))
      ? refreshUrl : 'entrelles://kyc-cancel';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: validRefreshUrl,
      return_url: validReturnUrl,
      type: 'account_onboarding'
    });

    user.kyc.lastOnboardingLinkCreated = new Date();
    user.kyc.onboardingUrl = accountLink.url;
    user.kyc.onboardingExpiresAt = new Date(accountLink.expires_at * 1000);
    await user.save();

    res.status(200).json({
      success: true,
      onboarding: {
        url: accountLink.url,
        expires_at: accountLink.expires_at
      }
    });

  } catch (error) {
    console.error('Erreur création lien onboarding:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du lien d\'onboarding' });
  }
};

/**
 * @desc    Rafraîchir manuellement le statut KYC depuis Stripe
 * @route   POST /api/kyc/refresh
 * @access  Privé
 */
const refreshKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || !user.kyc?.stripeConnectAccountId) {
      return res.status(404).json({ success: false, message: 'Compte KYC non trouvé' });
    }

    const account = await stripe.accounts.retrieve(user.kyc.stripeConnectAccountId);

    user.kyc.status = account.details_submitted ?
      (account.charges_enabled && account.payouts_enabled ? 'verified' : 'pending') :
      'incomplete';
    user.kyc.canReceivePayments = account.charges_enabled && account.payouts_enabled;
    user.kyc.requiresOnboarding = !account.details_submitted;
    user.kyc.lastChecked = new Date();

    if (account.charges_enabled && account.payouts_enabled && !user.kyc.verifiedAt) {
      user.kyc.verifiedAt = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      kyc: {
        status: user.kyc.status,
        canReceivePayments: user.kyc.canReceivePayments,
        requiresOnboarding: user.kyc.requiresOnboarding,
        lastChecked: user.kyc.lastChecked
      }
    });

  } catch (error) {
    console.error('Erreur rafraîchissement KYC:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du rafraîchissement du statut KYC' });
  }
};

/**
 * Traitement du Webhook de mise à jour de compte Connect
 */
const handleConnectAccountUpdate = async (account) => {
  try {
    const user = await User.findOne({ 'kyc.stripeConnectAccountId': account.id });
    if (!user) return;

    user.kyc.status = account.details_submitted ?
      (account.charges_enabled && account.payouts_enabled ? 'verified' : 'pending') :
      'incomplete';
    user.kyc.canReceivePayments = account.charges_enabled && account.payouts_enabled;
    user.kyc.requiresOnboarding = !account.details_submitted;
    user.kyc.lastChecked = new Date();

    if (account.charges_enabled && account.payouts_enabled && !user.kyc.verifiedAt) {
      user.kyc.verifiedAt = new Date();
    }

    user.stripe = user.stripe || {};
    user.stripe.chargesEnabled = account.charges_enabled;
    user.stripe.payoutsEnabled = account.payouts_enabled;
    user.stripe.detailsSubmitted = account.details_submitted;

    await user.save();

  } catch (error) {
    console.error('Erreur lors du traitement du webhook Connect:', error);
  }
};

module.exports = {
  getKycStatus,
  startKycProcess,
  createOnboardingLink,
  refreshKycStatus,
  handleConnectAccountUpdate
};