const axios = require('axios');
const NodeCache = require('node-cache');

// Cache pour 24h afin d'optimiser l'utilisation des quotas API
const cache = new NodeCache({ stdTTL: 86400 });

/**
 * Service de gestion des cartes et itinéraires (OpenRouteService)
 */
class MapsService {
  constructor() {
    this.apiKey = process.env.OPENROUTE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://api.openrouteservice.org/v2';

    if (!this.apiKey) {
      console.warn('Attention : OPENROUTE_API_KEY non défini dans les variables d\'environnement');
    }
  }

  /**
   * Calcule la distance et la durée entre deux points
   * @param {Object} departure - { latitude, longitude }
   * @param {Object} arrival - { latitude, longitude }
   */
  async calculateDistance(departure, arrival) {
    if (!this.apiKey) throw new Error('API key non configurée');

    try {
      const cacheKey = `${departure.latitude},${departure.longitude}-${arrival.latitude},${arrival.longitude}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const response = await axios.post(
        `${this.baseUrl}/directions/driving-car`,
        {
          coordinates: [
            [departure.longitude, departure.latitude],
            [arrival.longitude, arrival.latitude]
          ]
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.routes || response.data.routes.length === 0) {
        throw new Error('Aucun itinéraire trouvé entre ces points');
      }

      const summary = response.data.routes[0].summary;
      const result = {
        distanceMeters: summary.distance,
        distanceKm: parseFloat((summary.distance / 1000).toFixed(2)),
        durationSeconds: summary.duration,
        durationHours: parseFloat((summary.duration / 3600).toFixed(2)),
      };

      cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Erreur calculateDistance:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupère l'itinéraire détaillé pour l'affichage sur une carte
   */
  async getDirections(departure, arrival) {
    if (!this.apiKey) throw new Error('API key non configurée');

    try {
      const response = await axios.post(
        `${this.baseUrl}/directions/driving-car/geojson`,
        {
          coordinates: [
            [departure.longitude, departure.latitude],
            [arrival.longitude, arrival.latitude]
          ]
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const coordinates = response.data.features[0].geometry.coordinates;
      return coordinates.map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }));

    } catch (error) {
      console.error('Erreur getDirections:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Suggère un prix basé sur la distance et le nombre de passagers
   */
  calculatePrice(distanceKm, availableSeats = 3) {
    const PRICE_PER_KM = 0.10;
    const FIXED_FEE = 0.50;
    const fuelCost = distanceKm * PRICE_PER_KM;
    const pricePerSeat = (fuelCost / availableSeats) + FIXED_FEE;
    return parseFloat(pricePerSeat.toFixed(2));
  }

  /**
   * Recherche les coordonnées d'une adresse (Géocodage)
   */
  async geocode(text) {
    if (!this.apiKey) throw new Error('API key non configurée');

    try {
      const response = await axios.get(`${this.baseUrl.replace('/v2', '')}/geocode/search`, {
        params: { api_key: this.apiKey, text: text, size: 1 }
      });

      if (!response.data || !response.data.features || response.data.features.length === 0) return null;

      const feature = response.data.features[0];
      const [lon, lat] = feature.geometry.coordinates;

      return { latitude: lat, longitude: lon, label: feature.properties.label };

    } catch (error) {
      console.error('Erreur geocode:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Recherche l'adresse correspondant à des coordonnées (Géocodage inversé)
   */
  async reverseGeocode(lat, lon) {
    if (!this.apiKey) throw new Error('API key non configurée');

    try {
      const response = await axios.get(`${this.baseUrl.replace('/v2', '')}/geocode/reverse`, {
        params: { api_key: this.apiKey, 'point.lat': lat, 'point.lon': lon, size: 1 }
      });

      if (!response.data || !response.data.features || response.data.features.length === 0) return null;

      return response.data.features[0].properties.label;

    } catch (error) {
      console.error('Erreur reverseGeocode:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Vide le cache du service
   */
  clearCache() {
    cache.flushAll();
  }

  /**
   * Récupère les statistiques d'utilisation du cache
   */
  getCacheStats() {
    return cache.getStats();
  }
}

module.exports = new MapsService();
