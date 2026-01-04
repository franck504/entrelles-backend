const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Toutes les routes de notifications sont protégées
router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
