const googleMapsService = require('../utils/googleMapsService');

/**
 * @route POST /api/maps/calculate-route
 * @desc Calcule la distance, durée et prix d'un trajet
 * @access Public
 */
exports.calculateRoute = async (req, res) => {
    try {
        const { departure, arrival, availableSeats = 3 } = req.body;

        // Validation
        if (!departure || !arrival) {
            return res.status(400).json({
                success: false,
                message: 'departure and arrival are required',
            });
        }

        if (!departure.latitude || !departure.longitude || !arrival.latitude || !arrival.longitude) {
            return res.status(400).json({
                success: false,
                message: 'latitude and longitude are required for both departure and arrival',
            });
        }

        console.log(`📍 Calcul itinéraire: ${departure.address || 'Unknown'} → ${arrival.address || 'Unknown'}`);

        // Calcul distance via Google Maps
        const distanceData = await googleMapsService.calculateDistance(
            { latitude: departure.latitude, longitude: departure.longitude },
            { latitude: arrival.latitude, longitude: arrival.longitude }
        );

        // Calcul du prix
        const pricePerSeat = googleMapsService.calculatePrice(
            distanceData.distanceKm,
            availableSeats
        );

        // Réponse
        const response = {
            success: true,
            data: {
                departure: {
                    latitude: departure.latitude,
                    longitude: departure.longitude,
                },
                arrival: {
                    latitude: arrival.latitude,
                    longitude: arrival.longitude,
                },
                distance: distanceData.distanceKm,
                duration: distanceData.durationHours,
                pricePerSeat,
                departureAddress: departure.address || '',
                arrivalAddress: arrival.address || '',
            },
            calculatedAt: new Date().toISOString(),
        };

        console.log(`✅ Réponse: ${distanceData.distanceKm}km, ${pricePerSeat}€/siège`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur calculateRoute:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate route',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * @route GET /api/maps/geocode
 * @desc Résout une adresse en coordonnées
 * @access Public
 */
exports.geocode = async (req, res) => {
    try {
        const { text } = req.query;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'text parameter is required',
            });
        }

        const data = await googleMapsService.geocode(text);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'No coordinates found for this address',
            });
        }

        res.json({
            success: true,
            data,
        });

    } catch (error) {
        console.error('❌ Erreur geocode controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to geocode address',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * @route GET /api/maps/cache-stats
 * @desc Statistiques du cache Google Maps
 * @access Public (à sécuriser en production)
 */
exports.getCacheStats = (req, res) => {
    try {
        const stats = googleMapsService.getCacheStats();
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get cache stats',
            error: error.message,
        });
    }
};

/**
 * @route DELETE /api/maps/cache
 * @desc Vider le cache (debug uniquement)
 * @access Private (à protéger en production)
 */
exports.clearCache = (req, res) => {
    try {
        googleMapsService.clearCache();
        res.json({
            success: true,
            message: 'Cache cleared successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to clear cache',
            error: error.message,
        });
    }
};
