const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/mapsController');

/**
 * Routes pour les services de cartographie et d'itinéraires
 */

// Calcul d'itinéraire (distance, durée, prix suggéré)
router.post('/calculate-route', mapsController.calculateRoute);

// Géocodage et géocodage inversé
router.get('/geocode', mapsController.geocode);
router.get('/reverse-geocode', mapsController.reverseGeocode);

// Gestion du cache
router.get('/cache-stats', mapsController.getCacheStats);
router.delete('/cache', mapsController.clearCache);

module.exports = router;