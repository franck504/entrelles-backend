const Notification = require('../models/Notification');

/**
 * @desc    Récupérer les notifications de l'utilisateur connecté
 * @route   GET /api/notifications
 * @access  Privé
 */
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'profile.displayName profile.avatar profile.profileImageUrl')
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
    console.error('Erreur récupération notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des notifications' });
  }
};

/**
 * @desc    Marquer une notification spécifique comme lue
 * @route   PUT /api/notifications/:id/read
 * @access  Privé
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) return res.status(404).json({ success: false, message: 'Notification non trouvée' });

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Action non autorisée' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('Erreur mise à jour notification:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de la notification' });
  }
};

/**
 * @desc    Marquer toutes les notifications de l'utilisateur comme lues
 * @route   PUT /api/notifications/read-all
 * @access  Privé
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (error) {
    console.error('Erreur mise à jour notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour des notifications' });
  }
};

/**
 * Utilitaire interne pour créer une notification
 */
const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Erreur création notification (helper):', error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification
};
