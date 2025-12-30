const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

// @desc    Obtenir le statut KYC de l'utilisateur
// @route   GET /api/kyc/status
// @access  Private
const getKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 Getting KYC status for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let kycData = {
      hasConnectAccount: false,
      status: 'not_started',
      canReceivePayments: false,
      requiresOnboarding: false,
      connectAccountId: null,
      message: 'Vérification KYC non démarrée'
    };

    // Si l'utilisateur a un compte Stripe Connect
    if (user.kyc?.stripeConnectAccountId) {
      console.log('📋 Checking Stripe account:', user.kyc.stripeConnectAccountId);

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

        // Mettre à jour les infos dans la base
        user.kyc.status = kycData.status;
        user.kyc.canReceivePayments = kycData.canReceivePayments;
        user.kyc.lastChecked = new Date();
        await user.save();

      } catch (stripeError) {
        console.error('❌ Stripe account error:', stripeError);
        kycData.message = 'Erreur lors de la vérification du compte';
      }
    }

    console.log('✅ KYC status retrieved:', kycData.status);

    res.status(200).json({
      success: true,
      kyc: kycData
    });

  } catch (error) {
    console.error('❌ Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving KYC status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Démarrer le processus KYC complet
// @route   POST /api/kyc/start
// @access  Private
const startKycProcess = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🚀 Starting KYC process for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Vérifier si l'utilisateur a déjà un compte
    if (user.kyc?.stripeConnectAccountId) {
      console.log('⚠️ User already has Connect account:', user.kyc.stripeConnectAccountId);

      // Créer directement le lien d'onboarding avec URLs HTTPS valides
      const baseUrl = process.env.FRONTEND_URL || 'https://entrelles-backend.vercel.app';

      const accountLink = await stripe.accountLinks.create({
        account: user.kyc.stripeConnectAccountId,
        refresh_url: `${baseUrl}/kyc/cancel?user_id=${userId}`,
        return_url: `${baseUrl}/kyc/success?user_id=${userId}`,
        type: 'account_onboarding'
      });

      return res.status(200).json({
        success: true,
        message: 'Onboarding link created for existing account',
        account: {
          id: user.kyc.stripeConnectAccountId
        },
        onboarding: {
          url: accountLink.url,
          expires_at: accountLink.expires_at
        }
      });
    }

    // Créer un nouveau compte Stripe Connect
    console.log('🆕 Creating new Stripe Connect account...');

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
      metadata: {
        userId: userId.toString(),
        platform: 'entrelles'
      }
    });

    console.log('✅ Stripe Connect account created:', account.id);

    // Sauvegarder dans la base de données
    user.kyc = user.kyc || {};
    user.kyc.stripeConnectAccountId = account.id;
    user.kyc.status = 'pending';
    user.kyc.accountType = 'express';
    user.kyc.createdAt = new Date();
    user.kyc.lastChecked = new Date();
    user.kyc.requiresOnboarding = true;
    user.kyc.canReceivePayments = false;

    await user.save();
    console.log('✅ User KYC data saved');

    // Créer le lien d'onboarding avec URLs valides pour Stripe
    // Stripe n'accepte que HTTPS ou localhost, pas les deep links custom schemes
    // On utilise des URLs HTTPS qui redirigent vers l'app
    const baseUrl = process.env.FRONTEND_URL || 'https://entrelles-backend.vercel.app';

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/kyc/cancel?user_id=${userId}`,
      return_url: `${baseUrl}/kyc/success?user_id=${userId}`,
      type: 'account_onboarding'
    });

    console.log('✅ Onboarding link created');

    res.status(201).json({
      success: true,
      message: 'KYC process started successfully',
      account: {
        id: account.id,
        type: account.type,
        country: account.country
      },
      onboarding: {
        url: accountLink.url,
        expires_at: accountLink.expires_at,
        expiresIn: '24 hours'
      }
    });

  } catch (error) {
    console.error('❌ Start KYC process error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting KYC process',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ NOUVELLE FONCTION - Créer un compte complet (utilisée par Flutter)
// @desc    Créer un compte KYC complet
// @route   POST /api/kyc/create-complete-account
// @access  Private
const createCompleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🏗️ Creating complete KYC account for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Vérifier si l'utilisateur a déjà un compte
    if (user.kyc?.stripeConnectAccountId) {
      return res.status(400).json({
        success: false,
        message: 'User already has a KYC account',
        accountId: user.kyc.stripeConnectAccountId
      });
    }

    // Créer le compte Stripe Connect Express
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
        first_name: user.profile.firstName || user.profile.displayName?.split(' ')[0] || 'Utilisatrice',
        last_name: user.profile.lastName || user.profile.displayName?.split(' ').slice(1).join(' ') || 'Entrelles'
      },
      metadata: {
        userId: userId.toString(),
        platform: 'entrelles',
        createdVia: 'flutter_app'
      }
    });

    console.log('✅ Complete Stripe account created:', account.id);

    // Sauvegarder dans la base de données
    user.kyc = user.kyc || {};
    user.kyc.stripeConnectAccountId = account.id;
    user.kyc.status = 'pending';
    user.kyc.accountType = 'express';
    user.kyc.createdAt = new Date();
    user.kyc.lastChecked = new Date();
    user.kyc.requiresOnboarding = !account.details_submitted;
    user.kyc.canReceivePayments = account.charges_enabled && account.payouts_enabled;

    await user.save();
    console.log('✅ Complete account data saved');

    res.status(201).json({
      success: true,
      message: 'Complete KYC account created successfully',
      account: {
        id: account.id,
        type: account.type,
        country: account.country,
        email: account.email,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled
      },
      kyc: {
        status: user.kyc.status,
        requiresOnboarding: user.kyc.requiresOnboarding,
        canReceivePayments: user.kyc.canReceivePayments
      }
    });

  } catch (error) {
    console.error('❌ Create complete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating complete KYC account',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Créer un lien d'onboarding Stripe Connect
// @route   POST /api/kyc/create-onboarding-link
// @access  Private
const createOnboardingLink = async (req, res) => {
  try {
    const { accountId, returnUrl, refreshUrl } = req.body;
    const userId = req.user.id;

    console.log('🔗 Creating onboarding link for account:', accountId);

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    // Vérifier que l'utilisateur possède ce compte
    const user = await User.findById(userId);
    if (!user || user.kyc?.stripeConnectAccountId !== accountId) {
      return res.status(403).json({
        success: false,
        message: 'Account not found or not owned by user'
      });
    }

    // URLs par défaut sécurisées
    const validReturnUrl = returnUrl && (returnUrl.startsWith('https://') || returnUrl.startsWith('entrelles://'))
      ? returnUrl
      : 'entrelles://kyc-success';

    const validRefreshUrl = refreshUrl && (refreshUrl.startsWith('https://') || refreshUrl.startsWith('entrelles://'))
      ? refreshUrl
      : 'entrelles://kyc-cancel';

    console.log('✅ Using return URL:', validReturnUrl);
    console.log('✅ Using refresh URL:', validRefreshUrl);

    // Créer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: validRefreshUrl,
      return_url: validReturnUrl,
      type: 'account_onboarding'
    });

    // Mettre à jour le statut
    user.kyc.lastOnboardingLinkCreated = new Date();
    user.kyc.onboardingUrl = accountLink.url;
    user.kyc.onboardingExpiresAt = new Date(accountLink.expires_at * 1000);
    await user.save();

    console.log('✅ Onboarding link created successfully');

    res.status(200).json({
      success: true,
      message: 'Onboarding link created successfully',
      onboarding: {
        url: accountLink.url,
        expires_at: accountLink.expires_at,
        accountId: accountId,
        expiresIn: '24 hours'
      }
    });

  } catch (error) {
    console.error('❌ Create onboarding link error:', error);

    // Gestion d'erreurs détaillée
    let errorMessage = 'Error creating onboarding link';
    let statusCode = 500;

    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid Stripe request: ' + error.message;
      statusCode = 400;
    } else if (error.code === 'account_invalid') {
      errorMessage = 'Invalid Stripe account';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        type: error.type,
        code: error.code,
        param: error.param
      } : null
    });
  }
};

// ✅ FONCTION OPTIONNELLE - Rafraîchir le statut KYC
// @desc    Rafraîchir le statut KYC depuis Stripe
// @route   POST /api/kyc/refresh
// @access  Private
const refreshKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔄 Refreshing KYC status for user:', userId);

    const user = await User.findById(userId);
    if (!user || !user.kyc?.stripeConnectAccountId) {
      return res.status(404).json({
        success: false,
        message: 'No KYC account found for this user'
      });
    }

    // Récupérer les infos à jour depuis Stripe
    const account = await stripe.accounts.retrieve(user.kyc.stripeConnectAccountId);

    // Mettre à jour le statut local
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

    console.log('✅ KYC status refreshed:', user.kyc.status);

    res.status(200).json({
      success: true,
      message: 'KYC status refreshed successfully',
      kyc: {
        status: user.kyc.status,
        canReceivePayments: user.kyc.canReceivePayments,
        requiresOnboarding: user.kyc.requiresOnboarding,
        lastChecked: user.kyc.lastChecked,
        verifiedAt: user.kyc.verifiedAt
      }
    });

  } catch (error) {
    console.error('❌ Refresh KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing KYC status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ AJOUTER une fonction pour traiter les webhooks Connect
const handleConnectAccountUpdate = async (account) => {
  try {
    console.log('🔄 Processing Connect account update:', account.id);

    const user = await User.findOne({ 'kyc.stripeConnectAccountId': account.id });
    if (!user) {
      console.log('⚠️ No user found for Connect account:', account.id);
      return;
    }

    // ✅ METTRE À JOUR le statut KYC
    const oldStatus = user.kyc.status;
    user.kyc.status = account.details_submitted ?
      (account.charges_enabled && account.payouts_enabled ? 'verified' : 'pending') :
      'incomplete';
    user.kyc.canReceivePayments = account.charges_enabled && account.payouts_enabled;
    user.kyc.requiresOnboarding = !account.details_submitted;
    user.kyc.lastChecked = new Date();

    // Marquer comme vérifié si c'est le cas
    if (account.charges_enabled && account.payouts_enabled && !user.kyc.verifiedAt) {
      user.kyc.verifiedAt = new Date();
    }

    // Sauvegarder les infos Stripe dans le profil utilisateur
    user.stripe = user.stripe || {};
    user.stripe.chargesEnabled = account.charges_enabled;
    user.stripe.payoutsEnabled = account.payouts_enabled;
    user.stripe.detailsSubmitted = account.details_submitted;

    await user.save();

    console.log(`✅ KYC status updated for user ${user.email}: ${oldStatus} → ${user.kyc.status}`);

    // ✅ Si le compte vient d'être vérifié, traiter les paiements en attente
    if (oldStatus !== 'verified' && user.kyc.status === 'verified') {
      console.log('🎉 Account just got verified, processing held payments...');
      await processHeldPayments(user._id);
    }

  } catch (error) {
    console.error('❌ Error updating KYC status:', error);
  }
};

// ✅ AJOUTER fonction pour traiter paiements en attente
const processHeldPayments = async (driverId) => {
  try {
    console.log('💰 Processing held payments for driver:', driverId);

    const Booking = require('../models/Booking');
    const heldBookings = await Booking.find({
      driver: driverId,
      'payment.status': 'succeeded',
      'payment.transferPending': true
    });

    console.log(`Found ${heldBookings.length} held payments to process`);

    for (const booking of heldBookings) {
      try {
        await createDelayedTransfer(booking);
        console.log('✅ Processed held payment for booking:', booking._id);
      } catch (error) {
        console.error('❌ Error processing held payment:', booking._id, error);
      }
    }

  } catch (error) {
    console.error('❌ Error processing held payments:', error);
  }
};

// ✅ AJOUTER fonction pour créer transfert différé
const createDelayedTransfer = async (booking) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const User = require('../models/User');

    // Récupérer le driver avec son compte Connect
    const driver = await User.findById(booking.driver);
    if (!driver || !driver.kyc?.stripeConnectAccountId) {
      throw new Error('Driver Connect account not found');
    }

    // Créer le transfert
    const transfer = await stripe.transfers.create({
      amount: booking.payment.driverAmount,
      currency: 'eur',
      destination: driver.kyc.stripeConnectAccountId,
      description: `Paiement différé - Réservation ${booking._id}`,
      metadata: {
        bookingId: booking._id.toString(),
        type: 'delayed_transfer',
        originalPaymentIntent: booking.payment.stripePaymentIntentId
      }
    });

    // Mettre à jour la réservation
    booking.payment.transferPending = false;
    booking.payment.driverPayout = {
      status: 'paid',
      stripeTransferId: transfer.id,
      amount: booking.payment.driverAmount,
      paidAt: new Date(),
      transferDate: new Date()
    };

    await booking.save();

    console.log('✅ Delayed transfer created:', transfer.id);
    return transfer;

  } catch (error) {
    console.error('❌ Error creating delayed transfer:', error);
    throw error;
  }
};

// ✅ EXPORT NETTOYÉ - SANS ALIAS INUTILES
module.exports = {
  getKycStatus,
  startKycProcess,
  createCompleteAccount,    // ✅ NOUVELLE FONCTION AJOUTÉE
  createOnboardingLink,
  refreshKycStatus,          // ✅ FONCTION OPTIONNELLE
  handleConnectAccountUpdate,  // ✅ NOUVEAU
  processHeldPayments         // ✅ NOUVEAU
};