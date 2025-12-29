const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/mapsController');

/**
 * @route   POST /api/maps/calculate-route
 * @desc    Calcule distance, durée et prix d'un trajet
 * @access  Public
 */
router.post('/calculate-route', mapsController.calculateRoute);

/**
 * @route   GET /api/maps/cache-stats
 * @desc    Statistiques du cache Google Maps
 * @access  Public
 */
router.get('/cache-stats', mapsController.getCacheStats);

/**
 * @route   DELETE /api/maps/cache
 * @desc    Vider le cache (debug)
 * @access  Private
 */
router.delete('/cache', mapsController.clearCache);

module.exports = router;
