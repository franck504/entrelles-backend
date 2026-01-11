const express = require('express');
const router = express.Router();
const { chatWithAi } = require('../controllers/aiController');

// Route publique pour l'assistant (utilisable même sans être connecté pour guider les nouvelles)
router.post('/chat', chatWithAi);

module.exports = router;
