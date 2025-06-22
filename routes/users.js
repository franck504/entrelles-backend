const express = require('express');
const router = express.Router();

// Controllers
const {
  getPublicProfile,
  uploadAvatar,
  updateCompleteProfile,
  upload
} = require('../controllers/userController');

// Middleware
const { protect } = require('../middleware/authMiddleware');

// ===== ROUTES PUBLIQUES =====
router.get('/:id', getPublicProfile);

// ===== ROUTES PROTÉGÉES =====
router.use(protect);
router.put('/profile', updateCompleteProfile);
router.post('/upload-avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;
