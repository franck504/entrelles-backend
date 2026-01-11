const express = require('express');
const router = express.Router();
const { sendMessage, getConversations, getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/:conversationId', protect, getMessages);

module.exports = router;
