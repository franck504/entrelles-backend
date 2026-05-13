const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getKycStatus,
  startKycProcess,
  createCompleteAccount,
  createOnboardingLink,
  refreshKycStatus
} = require('../controllers/kycController');

/**
 * Points de retour publics après le processus d'onboarding Stripe
 */
router.get('/success', (req, res) => {
  const userId = req.query.user_id;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=entrelles://kyc-success?user_id=${userId}">
      <title>Vérification Réussie</title>
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
      <h2>Vérification réussie</h2>
      <p>Redirection vers l'application en cours...</p>
      <p><a href="entrelles://kyc-success?user_id=${userId}">Cliquez ici si la redirection ne fonctionne pas</a></p>
    </body>
    </html>
  `);
});

router.get('/cancel', (req, res) => {
  const userId = req.query.user_id;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=entrelles://kyc-cancel?user_id=${userId}">
      <title>Vérification Annulée</title>
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
      <h2>Vérification annulée</h2>
      <p>Redirection vers l'application en cours...</p>
      <p><a href="entrelles://kyc-cancel?user_id=${userId}">Cliquez ici si la redirection ne fonctionne pas</a></p>
    </body>
    </html>
  `);
});

/**
 * Routes privées pour la gestion du KYC
 */
router.use(protect);

router.get('/status', getKycStatus);
router.post('/start', startKycProcess);
router.post('/create-complete-account', createCompleteAccount);
router.post('/create-onboarding-link', createOnboardingLink);
router.post('/refresh', refreshKycStatus);

module.exports = router;