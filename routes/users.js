const express = require('express');
const router = express.Router();

// Controllers
const {
  getPublicProfile,
  uploadAvatar,
  updateCompleteProfile,
  uploadUserImage,
  getNearbyDrivers,
  deleteAllUsers,
  upload
} = require('../controllers/userController');

// Middleware
const { protect } = require('../middleware/authMiddleware');

// ===== ROUTES PUBLIQUES =====
router.get('/nearby-drivers', getNearbyDrivers);
router.get('/:id', getPublicProfile);

// ===== ROUTES PROTÉGÉES =====
router.use(protect);
router.put('/profile', updateCompleteProfile);
router.post('/upload-avatar', upload.single('avatar'), uploadAvatar);
router.post('/upload-image', upload.single('image'), uploadUserImage);

module.exports = router;
