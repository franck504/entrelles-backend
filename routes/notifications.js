const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// ✅ ROUTE PUBLIQUE
router.delete('/delete-all', deleteAllNotifications);

// Toutes les routes de notifications sont protégées
router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
