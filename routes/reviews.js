const express = require('express');
const router = express.Router();
const { createReview, getUserReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Routes pour la gestion des avis et notations
 */

// Laisser un avis (authentification requise)
router.post('/', protect, createReview);

// Consulter les avis d'une utilisatrice
router.get('/user/:userId', getUserReviews);

module.exports = router;
