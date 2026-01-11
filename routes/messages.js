const express = require('express');
const router = express.Router();
const { sendMessage, getConversations, getMessages, markMessagesAsRead } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/:conversationId', protect, getMessages);
router.put('/:conversationId/read', protect, markMessagesAsRead);

module.exports = router;
