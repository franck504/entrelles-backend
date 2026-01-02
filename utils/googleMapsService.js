const axios = require('axios');
const NodeCache = require('node-cache');

// Cache pour 24h (économie de quota)
const cache = new NodeCache({ stdTTL: 86400 });

class MapsService {
    constructor() {
        // ✅ OpenRouteService API (GRATUIT 2500 req/jour)
        this.apiKey = process.env.OPENROUTE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
        this.baseUrl = 'https://api.openrouteservice.org/v2';

        if (!this.apiKey) {
            console.warn('⚠️ WARNING: OPENROUTE_API_KEY non défini dans .env');
            console.warn('Les fonctionnalités de carte seront désactivées');
        } else {
            console.log('✅ OpenRouteService configuré (2500 req/jour gratuit)');
        }
    }

    /**
     * Calcule la distance et la durée entre deux points
     * @param {Object} departure - { latitude, longitude }
     * @param {Object} arrival - { latitude, longitude }
     * @returns {Promise<Object>} { distance, duration }
     */
    async calculateDistance(departure, arrival) {
        if (!this.apiKey) {
            throw new Error('OpenRouteService API key is not configured');
        }

        try {
            // Vérifier le cache
            const cacheKey = `${departure.latitude},${departure.longitude}-${arrival.latitude},${arrival.longitude}`;
            const cached = cache.get(cacheKey);

            if (cached) {
                console.log('✅ Résultat Maps depuis le cache');
                return cached;
            }

            console.log('📍 Appel OpenRouteService Directions API...');

            // ✅ Appel API OpenRouteService
            // Doc: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/post
            const response = await axios.post(
                `${this.baseUrl}/directions/driving-car`,
                {
                    coordinates: [
                        [departure.longitude, departure.latitude],  // ORS utilise [lon, lat]
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
                throw new Error('No route found between these points');
            }

            const route = response.data.routes[0];
            const summary = route.summary;

            const result = {
                distanceMeters: summary.distance,
                distanceKm: parseFloat((summary.distance / 1000).toFixed(2)),
                durationSeconds: summary.duration,
                durationHours: parseFloat((summary.duration / 3600).toFixed(2)),
            };

            // Mise en cache
            cache.set(cacheKey, result);
            console.log(`✅ Distance: ${result.distanceKm} km, Durée: ${result.durationHours}h`);

            return result;
        } catch (error) {
            console.error('❌ Erreur calculateDistance:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Récupère l'itinéraire détaillé (polyline)
     * @param {Object} departure - { latitude, longitude }
     * @param {Object} arrival - { latitude, longitude }
     * @returns {Promise<Array>} Points de la polyline
     */
    async getDirections(departure, arrival) {
        if (!this.apiKey) {
            throw new Error('OpenRouteService API key is not configured');
        }

        try {
            console.log('📍 Appel OpenRouteService Directions API (avec géométrie)...');

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

            const route = response.data.features[0];
            const coordinates = route.geometry.coordinates;

            // Convertir [lon, lat] en {lat, lng} pour Flutter
            const polylinePoints = coordinates.map(coord => ({
                lng: coord[0],
                lat: coord[1]
            }));

            console.log('✅ Itinéraire récupéré');
            return polylinePoints;
        } catch (error) {
            console.error('❌ Erreur getDirections:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Calcule le prix basé sur la distance
     * @param {number} distanceKm - Distance en km
     * @param {number} availableSeats - Nombre de places disponibles
     * @returns {number} Prix par siège
     */
    calculatePrice(distanceKm, availableSeats = 3) {
        const PRICE_PER_KM = 0.10; // 0.10€/km
        const FIXED_FEE = 0.50; // 0.50€ frais fixes par siège

        const fuelCost = distanceKm * PRICE_PER_KM;
        const pricePerSeat = (fuelCost / availableSeats) + FIXED_FEE;

        return parseFloat(pricePerSeat.toFixed(2));
    }

    /**
     * Convertit une adresse en coordonnées (Geocoding)
     * @param {string} text - L'adresse à rechercher
     * @returns {Promise<Object>} { latitude, longitude, label }
     */
    async geocode(text) {
        if (!this.apiKey) {
            throw new Error('OpenRouteService API key is not configured');
        }

        try {
            console.log(`🔍 Appel OpenRouteService Geocoding API pour: ${text}`);

            const response = await axios.get(`${this.baseUrl.replace('/v2', '')}/geocode/search`, {
                params: {
                    api_key: this.apiKey,
                    text: text,
                    size: 1
                }
            });

            if (!response.data || !response.data.features || response.data.features.length === 0) {
                console.warn(`⚠️ Aucun résultat trouvé pour: ${text}`);
                return null;
            }

            const feature = response.data.features[0];
            const [lon, lat] = feature.geometry.coordinates;

            return {
                latitude: lat,
                longitude: lon,
                label: feature.properties.label
            };
        } catch (error) {
            console.error('❌ Erreur geocode:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Vide le cache (utile pour debug)
     */
    clearCache() {
        cache.flushAll();
        console.log('🗑️ Cache Maps vidé');
    }

    /**
     * Statistiques du cache
     */
    getCacheStats() {
        return cache.getStats();
    }
}

module.exports = new MapsService();
