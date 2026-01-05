const Notification = require('../models/Notification');

// @desc    Obtenir les notifications de l'utilisateur
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false
        });

        res.status(200).json({
            success: true,
            count: notifications.length,
            unreadCount,
            notifications
        });
    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications'
        });
    }
};

// @desc    Marquer une notification comme lue
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        // Vérifier que c'est bien le destinataire
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé'
            });
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({
            success: true,
            message: 'Notification marquée comme lue'
        });
    } catch (error) {
        console.error('❌ Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la notification'
        });
    }
};

// @desc    Marquer toutes les notifications comme lues
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );

        res.status(200).json({
            success: true,
            message: 'Toutes les notifications ont été marquées comme lues'
        });
    } catch (error) {
        console.error('❌ Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour des notifications'
        });
    }
};

// Fonction helper pour créer une notification (utilisée par d'autres controllers)
const createNotification = async (data) => {
    try {
        const notification = await Notification.create(data);
        console.log(`🔔 Notification créée: ${data.type} pour ${data.recipient}`);
        return notification;
    } catch (error) {
        console.error('❌ Error creating notification helper:', error);
    }
};

const deleteAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({});
        console.log('🗑️ Toutes les notifications ont été supprimées');
        res.status(200).json({
            success: true,
            message: 'Toutes les notifications ont été supprimées'
        });
    } catch (error) {
        console.error('❌ Error deleting all notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression des notifications'
        });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteAllNotifications
};
