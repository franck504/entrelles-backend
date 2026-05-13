const cityData = {
  'Paris': { 
    lat: 48.8566, lng: 2.3522,
    addresses: ['Gare de Lyon, 75012 Paris', 'Gare du Nord, 75010 Paris', 'Châtelet-Les Halles, 75001 Paris']
  },
  'Lyon': { 
    lat: 45.7640, lng: 4.8357,
    addresses: ['Gare Part-Dieu, 69003 Lyon', 'Gare Perrache, 69002 Lyon']
  },
  'Marseille': { 
    lat: 43.2965, lng: 5.3698,
    addresses: ['Gare Saint-Charles, 13001 Marseille', 'Vieux-Port, 13002 Marseille']
  },
  'Toulouse': { 
    lat: 43.6047, lng: 1.4442,
    addresses: ['Gare Matabiau, 31000 Toulouse', 'Place du Capitole, 31000 Toulouse']
  },
  'Nice': { 
    lat: 43.7102, lng: 7.2620,
    addresses: ['Gare de Nice-Ville, 06000 Nice']
  },
  'Bordeaux': { 
    lat: 44.8378, lng: -0.5792,
    addresses: ['Gare Saint-Jean, 33000 Bordeaux']
  }
};

const distanceMatrix = {
  'Paris-Lyon': 465, 'Lyon-Paris': 465,
  'Paris-Marseille': 775, 'Marseille-Paris': 775,
  'Paris-Toulouse': 680, 'Toulouse-Paris': 680,
  'Paris-Nice': 930, 'Nice-Paris': 930,
  'Paris-Bordeaux': 580, 'Bordeaux-Paris': 580,
  'Lyon-Marseille': 315, 'Marseille-Lyon': 315,
  'Lyon-Nice': 470, 'Nice-Lyon': 470
};

/**
 * Middleware pour enrichir les données de trajet (coordonnées, distances par défaut)
 */
const enrichTripData = (req, res, next) => {
  try {
    // Enrichissement du lieu de départ
    if (req.body.departure && req.body.departure.city) {
      const city = req.body.departure.city;
      const cityInfo = cityData[city];
      
      if (cityInfo) {
        if (!req.body.departure.coordinates) {
          req.body.departure.coordinates = { lat: cityInfo.lat, lng: cityInfo.lng };
        }
        if (!req.body.departure.address) {
          req.body.departure.address = cityInfo.addresses[Math.floor(Math.random() * cityInfo.addresses.length)];
        }
      }
    }

    // Enrichissement du lieu d'arrivée
    if (req.body.arrival && req.body.arrival.city) {
      const city = req.body.arrival.city;
      const cityInfo = cityData[city];
      
      if (cityInfo) {
        if (!req.body.arrival.coordinates) {
          req.body.arrival.coordinates = { lat: cityInfo.lat, lng: cityInfo.lng };
        }
        if (!req.body.arrival.address) {
          req.body.arrival.address = cityInfo.addresses[Math.floor(Math.random() * cityInfo.addresses.length)];
        }
      }
    }

    // Calcul de la distance et durée par défaut
    if (!req.body.distance && req.body.departure?.city && req.body.arrival?.city) {
      const route = `${req.body.departure.city}-${req.body.arrival.city}`;
      req.body.distance = distanceMatrix[route] || Math.floor(Math.random() * 400) + 200;
    }

    if (!req.body.estimatedDuration && req.body.distance) {
      req.body.estimatedDuration = Math.floor(req.body.distance / 90 * 60); // Estimation à 90km/h
    }

    if (!req.body.availableSeats) {
      req.body.availableSeats = Math.floor(Math.random() * 3) + 1;
    }

    next();

  } catch (error) {
    console.error('Erreur enrichissement des données de trajet:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'enrichissement des données' });
  }
};

/**
 * Middleware exigeant une vérification KYC (Stripe Connect) pour créer un trajet
 */
const requireKycVerification = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    
    const kycStatus = user.getKycStatus();
    
    if (!kycStatus.canReceivePayments) {
      return res.status(403).json({
        success: false,
        message: 'Vérification d\'identité requise pour proposer des trajets',
        error: 'KYC_VERIFICATION_REQUIRED',
        kyc: {
          status: kycStatus.status,
          requiresOnboarding: kycStatus.requiresOnboarding,
          connectAccountId: kycStatus.connectAccountId
        }
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur vérification KYC:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la vérification d\'identité' });
  }
};

module.exports = { 
  enrichTripData,
  requireKycVerification
};