const googleMapsService = require('../utils/googleMapsService');

/**
 * @desc    Calcule l'itinéraire, la distance, la durée et le prix suggéré
 * @route   POST /api/maps/calculate-route
 * @access  Public
 */
exports.calculateRoute = async (req, res) => {
  try {
    const { departure, arrival, availableSeats = 3 } = req.body;

    if (!departure || !arrival) {
      return res.status(400).json({ success: false, message: 'Le départ et l\'arrivée sont requis' });
    }

    if (!departure.latitude || !departure.longitude || !arrival.latitude || !arrival.longitude) {
      return res.status(400).json({ success: false, message: 'Les coordonnées (lat/lng) sont requises' });
    }

    const distanceData = await googleMapsService.calculateDistance(
      { latitude: departure.latitude, longitude: departure.longitude },
      { latitude: arrival.latitude, longitude: arrival.longitude }
    );

    const pricePerSeat = googleMapsService.calculatePrice(distanceData.distanceKm, availableSeats);

    res.json({
      success: true,
      data: {
        departure: { latitude: departure.latitude, longitude: departure.longitude },
        arrival: { latitude: arrival.latitude, longitude: arrival.longitude },
        distance: distanceData.distanceKm,
        duration: distanceData.durationHours,
        pricePerSeat,
        departureAddress: departure.address || '',
        arrivalAddress: arrival.address || '',
      }
    });

  } catch (error) {
    console.error('Erreur calculateRoute:', error);
    res.status(500).json({ success: false, message: 'Échec du calcul de l\'itinéraire' });
  }
};

/**
 * @desc    Géocodage : transforme une adresse textuelle en coordonnées
 * @route   GET /api/maps/geocode
 * @access  Public
 */
exports.geocode = async (req, res) => {
  try {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Le paramètre text est requis' });
    }

    const data = await googleMapsService.geocode(text);

    if (!data) {
      return res.status(404).json({ success: false, message: 'Aucune coordonnée trouvée pour cette adresse' });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Erreur geocode controller:', error);
    res.status(500).json({ success: false, message: 'Échec du géocodage' });
  }
};

/**
 * @desc    Géocodage inversé : transforme des coordonnées en adresse textuelle
 * @route   GET /api/maps/reverse-geocode
 * @access  Public
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Les paramètres lat et lon sont requis' });
    }

    const address = await googleMapsService.reverseGeocode(lat, lon);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Aucune adresse trouvée pour ces coordonnées' });
    }

    res.json({ success: true, data: { address } });

  } catch (error) {
    console.error('Erreur reverse-geocode controller:', error);
    res.status(500).json({ success: false, message: 'Échec du géocodage inversé' });
  }
};

/**
 * @desc    Récupérer les statistiques du cache Google Maps
 * @route   GET /api/maps/cache-stats
 * @access  Public
 */
exports.getCacheStats = (req, res) => {
  try {
    const stats = googleMapsService.getCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Échec de la récupération des stats du cache' });
  }
};

/**
 * @desc    Vider le cache de géocodage
 * @route   DELETE /api/maps/cache
 * @access  Privé
 */
exports.clearCache = (req, res) => {
  try {
    googleMapsService.clearCache();
    res.json({ success: true, message: 'Cache vidé avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Échec du vidage du cache' });
  }
};