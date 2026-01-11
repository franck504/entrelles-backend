const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * @desc    Envoyer un message ou démarrer une conversation
 * @route   POST /api/messages
 */
const sendMessage = async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const senderId = req.user.id;

        // 1. Trouver ou créer la conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId]
            });
        }

        // 2. Créer le message
        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            receiverId,
            text
        });

        // 3. Mettre à jour la conversation avec le dernier message
        conversation.lastMessage = message._id;
        conversation.updatedAt = Date.now();
        await conversation.save();

        res.status(201).json({
            success: true,
            message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du message',
            error: error.message
        });
    }
};

/**
 * @desc    Obtenir toutes les conversations de l'utilisateur
 * @route   GET /api/messages/conversations
 */
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user.id
        })
            .populate('participants', 'profile.displayName profile.avatar profile.profileImageUrl')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        // Ajouter le nombre de messages non lus pour chaque conversation
        const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                receiverId: req.user.id,
                isRead: false
            });
            return {
                ...conv.toObject(),
                unreadCount
            };
        }));

        res.status(200).json({
            success: true,
            conversations: conversationsWithUnread
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des conversations',
            error: error.message
        });
    }
};

/**
 * @desc    Marquer tous les messages d'une conversation comme lus
 * @route   PUT /api/messages/:conversationId/read
 */
const markMessagesAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        await Message.updateMany(
            { conversationId, receiverId: userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: 'Messages marqués comme lus'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage des messages',
            error: error.message
        });
    }
};

/**
 * @desc    Obtenir les messages d'une conversation
 * @route   GET /api/messages/:conversationId
 */
const getMessages = async (req, res) => {
    try {
        const messages = await Message.find({
            conversationId: req.params.conversationId
        }).sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des messages',
            error: error.message
        });
    }
};

module.exports = {
    sendMessage,
    getConversations,
    getMessages,
    markMessagesAsRead
};
