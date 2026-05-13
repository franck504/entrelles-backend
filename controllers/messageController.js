const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * @desc    Envoyer un message ou démarrer une conversation
 * @route   POST /api/messages
 * @access  Privé
 */
const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user.id;

    // Recherche ou création d'une conversation entre les deux participantes
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId]
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text
    });

    // Mise à jour du dernier message de la conversation
    conversation.lastMessage = message._id;
    conversation.updatedAt = Date.now();
    await conversation.save();

    res.status(201).json({ success: true, message });

  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message' });
  }
};

/**
 * @desc    Récupérer toutes les conversations de l'utilisatrice
 * @route   GET /api/messages/conversations
 * @access  Privé
 */
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate('participants', 'profile.displayName profile.profileImageUrl')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Calcul du nombre de messages non lus par conversation
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

    res.status(200).json({ success: true, conversations: conversationsWithUnread });

  } catch (error) {
    console.error('Erreur récupération conversations:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des conversations' });
  }
};

/**
 * @desc    Marquer les messages d'une conversation comme lus
 * @route   PUT /api/messages/:conversationId/read
 * @access  Privé
 */
const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ success: true, message: 'Messages marqués comme lus' });

  } catch (error) {
    console.error('Erreur marquage messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du marquage des messages' });
  }
};

/**
 * @desc    Récupérer les messages d'une conversation spécifique
 * @route   GET /api/messages/:conversationId
 * @access  Privé
 */
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
      .sort({ createdAt: -1 })
      .limit(50);

    // Inversion pour affichage chronologique
    const orderedMessages = messages.reverse();

    res.status(200).json({ success: true, messages: orderedMessages });

  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages' });
  }
};

module.exports = {
  sendMessage,
  getConversations,
  getMessages,
  markMessagesAsRead
};
