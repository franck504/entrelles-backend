const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import des fonctions du controller
const {
  getKycStatus,
  startKycProcess,
  createCompleteAccount,
  createOnboardingLink,
  refreshKycStatus
} = require('../controllers/kycController');

// ✅ ROUTES PUBLIQUES - Redirections depuis Stripe vers l'app mobile
// Ces routes ne nécessitent PAS d'authentification (appelées par Stripe après onboarding)
router.get('/success', (req, res) => {
  const userId = req.query.user_id;
  console.log('🎉 KYC Success callback for user:', userId);

  // Redirection automatique vers l'app mobile via deep link
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=entrelles://kyc-success?user_id=${userId}">
      <title>Vérification Réussie</title>
    </head>
    <body style="font-family: Arial; text-align: center; padding: 50px;">
      <h2>✅ Vérification réussie !</h2>
      <p>Redirection vers l'application...</p>
      <p><a href="entrelles://kyc-success?user_id=${userId}">Cliquez ici si la redirection ne fonctionne pas</a></p>
    </body>
    </html>
  `);
});

router.get('/cancel', (req, res) => {
  const userId = req.query.user_id;
  console.log('❌ KYC Cancel callback for user:', userId);

  // Redirection automatique vers l'app mobile via deep link
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=entrelles://kyc-cancel?user_id=${userId}">
      <title>Vérification Annulée</title>
    </head>
    <body style="font-family: Arial; text-align: center; padding: 50px;">
      <h2>⚠️ Vérification annulée</h2>
      <p>Redirection vers l'application...</p>
      <p><a href="entrelles://kyc-cancel?user_id=${userId}">Cliquez ici si la redirection ne fonctionne pas</a></p>
    </body>
    </html>
  `);
});

// ✅ TOUTES LES ROUTES CI-DESSOUS NÉCESSITENT UNE AUTHENTIFICATION
router.use(protect);

// ✅ ROUTES PRINCIPALES - UTILISÉES PAR FLUTTER
router.get('/status', getKycStatus);
router.post('/start', startKycProcess);
router.post('/create-complete-account', createCompleteAccount);
router.post('/create-onboarding-link', createOnboardingLink);

// ✅ ROUTE OPTIONNELLE
router.post('/refresh', refreshKycStatus);

module.exports = router;