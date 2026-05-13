const express = require('express');
const router = express.Router();
const {
  getPublicProfile,
  updateCompleteProfile,
  uploadUserImage,
  getNearbyDrivers,
  upload
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Routes publiques de consultation des profils
 */
router.get('/nearby-drivers', getNearbyDrivers);
router.get('/:id', getPublicProfile);

/**
 * Routes protégées de gestion du profil personnel
 */
router.use(protect);

router.put('/profile', updateCompleteProfile);

// Upload d'images (photo de profil ou véhicule)
router.post('/upload-image', upload.single('image'), uploadUserImage);

module.exports = router;
