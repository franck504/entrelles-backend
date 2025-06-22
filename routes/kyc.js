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

// ✅ TOUTES LES ROUTES NÉCESSITENT UNE AUTHENTIFICATION
router.use(protect);

// ✅ ROUTES PRINCIPALES - UTILISÉES PAR FLUTTER
router.get('/status', getKycStatus);
router.post('/start', startKycProcess);
router.post('/create-complete-account', createCompleteAccount);  // ✅ ROUTE MANQUANTE AJOUTÉE
router.post('/create-onboarding-link', createOnboardingLink);

// ✅ ROUTE OPTIONNELLE
router.post('/refresh', refreshKycStatus);

// 🗑️ TOUTES LES ROUTES DEBUG SUPPRIMÉES :
// - /debug-user
// - /debug-controller  
// - /simulate-webhook
// - /create-fresh-account
// - /force-save-account
// - /accept-terms

module.exports = router;