const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const User = require('../models/User');

// ✅ FONCTION UTILITAIRE - Génération de données par défaut
const generateDefaultData = {
  // Coordonnées des principales villes françaises
  cityCoordinates: {
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'Lyon': { lat: 45.7640, lng: 4.8357 },
    'Marseille': { lat: 43.2965, lng: 5.3698 },
    'Toulouse': { lat: 43.6047, lng: 1.4442 },
    'Nice': { lat: 43.7102, lng: 7.2620 },
    'Nantes': { lat: 47.2184, lng: -1.5536 },
    'Bordeaux': { lat: 44.8378, lng: -0.5792 },
    'Lille': { lat: 50.6292, lng: 3.0573 },
    'Strasbourg': { lat: 48.5734, lng: 7.7521 },
    'Montpellier': { lat: 43.6110, lng: 3.8767 }
  },

  // Adresses réalistes par ville
  addresses: {
    'Paris': [
      'Gare de Lyon, 75012 Paris',
      'Gare du Nord, 75010 Paris',
      'Place de la République, 75003 Paris',
      'Châtelet-Les Halles, 75001 Paris'
    ],
    'Lyon': [
      'Gare Part-Dieu, 69003 Lyon',
      'Gare Perrache, 69002 Lyon',
      'Place Bellecour, 69002 Lyon'
    ],
    'Marseille': [
      'Gare Saint-Charles, 13001 Marseille',
      'Vieux-Port, 13002 Marseille'
    ],
    'Toulouse': [
      'Gare Matabiau, 31000 Toulouse',
      'Place du Capitole, 31000 Toulouse'
    ],
    'Nice': [
      'Gare de Nice-Ville, 06000 Nice',
      'Aéroport Nice Côte d\'Azur, 06206 Nice'
    ],
    'Bordeaux': [
      'Gare Saint-Jean, 33000 Bordeaux',
      'Place de la Bourse, 33000 Bordeaux'
    ]
  },

  // Véhicules réalistes
  vehicles: [
    { brand: 'Renault', model: 'Clio', colors: ['Blanc', 'Noir', 'Rouge', 'Bleu'] },
    { brand: 'Peugeot', model: '208', colors: ['Blanc', 'Gris', 'Rouge'] },
    { brand: 'Citroën', model: 'C3', colors: ['Blanc', 'Bleu', 'Rouge'] },
    { brand: 'Volkswagen', model: 'Polo', colors: ['Blanc', 'Noir', 'Gris'] },
    { brand: 'Toyota', model: 'Yaris', colors: ['Blanc', 'Rouge', 'Gris'] },
    { brand: 'Ford', model: 'Fiesta', colors: ['Blanc', 'Bleu', 'Rouge'] }
  ],

  // Calcul automatique de distance (approximatif)
  calculateDistance: (city1, city2) => {
    const distances = {
      'Paris-Lyon': 465, 'Lyon-Paris': 465,
      'Paris-Marseille': 775, 'Marseille-Paris': 775,
      'Paris-Toulouse': 680, 'Toulouse-Paris': 680,
      'Paris-Nice': 930, 'Nice-Paris': 930,
      'Paris-Bordeaux': 580, 'Bordeaux-Paris': 580,
      'Lyon-Marseille': 315, 'Marseille-Lyon': 315,
      'Lyon-Nice': 470, 'Nice-Lyon': 470,
      'Toulouse-Montpellier': 245, 'Montpellier-Toulouse': 245,
      'Bordeaux-Toulouse': 245, 'Toulouse-Bordeaux': 245
    };
    
    const key = `${city1}-${city2}`;
    return distances[key] || Math.floor(Math.random() * 400) + 200; // 200-600km par défaut
  },

  // Calcul automatique de durée (basé sur distance)
  calculateDuration: (distance) => {
    return Math.floor(distance / 90 * 60); // ~90km/h moyenne = minutes
  },

  // Prix automatique basé sur distance
  calculatePrice: (distance) => {
    return Math.floor(distance * 0.08) + Math.floor(Math.random() * 10); // ~8cts/km + variation
  }
};

// ✅ SIMPLIFIÉ - Le middleware a déjà enrichi les données
const createTrip = async (req, res) => {
  try {
    console.log('🚗 Création du trajet avec données enrichies...');

    // Les données sont déjà enrichies par le middleware
    const tripData = {
      driver: req.user.id,
      ...req.body,
      status: 'active'
    };

    // Calculer l'heure d'arrivée
    if (req.body.departureDateTime && req.body.estimatedDuration) {
      tripData.estimatedArrivalDateTime = new Date(
        new Date(req.body.departureDateTime).getTime() + 
        (req.body.estimatedDuration * 60 * 1000)
      );
    }

    console.log('📊 Données finales:', tripData);

    const trip = await Trip.create(tripData);
    await trip.populate('driver', 'profile.displayName profile.avatar stats.rating email');

    res.status(201).json({
      success: true,
      message: 'Trajet créé avec succès',
      trip: {
        id: trip._id,
        departure: trip.departure,
        arrival: trip.arrival,
        departureDateTime: trip.departureDateTime,
        estimatedArrivalDateTime: trip.estimatedArrivalDateTime,
        availableSeats: trip.availableSeats,
        totalSeats: trip.totalSeats,
        pricePerSeat: trip.pricePerSeat,
        distance: trip.distance,
        estimatedDuration: trip.estimatedDuration,
        description: trip.description,
        driver: {
          id: trip.driver._id,
          displayName: trip.driver.profile.displayName,
          email: trip.driver.email
        },
        createdAt: trip.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur création trajet:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du trajet',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


// ✅ NOUVELLE FONCTION - Recherche dynamique avec format Flutter
// @desc    Rechercher des trajets (version flexible pour Flutter)
// @route   GET /api/trips/search
// @access  Public
const searchTrips = async (req, res) => {
  try {
    console.log('🔍 Paramètres de recherche reçus:', req.query);

    // ✅ 1. EXTRACTION DES PARAMÈTRES (tous optionnels sauf passengers)
    const {
      departureCity,
      arrivalCity,
      departureDate,
      passengers = 1,
      maxPrice,
      minPrice,
      maxDuration,
      allowSmoking,
      allowPets,
      allowFood,
      musicPreference,
      chatLevel,
      minRating,
      sortBy = 'departureDateTime',
      sortOrder = 'asc',
      page = 1,
      limit = 10
    } = req.query;







    // ✅ 2. CONSTRUCTION REQUÊTE DYNAMIQUE
    const query = { 
      status: 'active',
      departureDateTime: { $gte: new Date() } // Seulement les trajets futurs
    };
    
    // Villes (recherche flexible avec regex insensible à la casse)
    if (departureCity && departureCity.trim()) {
      query['departure.city'] = { 
        $regex: departureCity.trim(), 
        $options: 'i' 
      };
    }
    
    if (arrivalCity && arrivalCity.trim()) {
      query['arrival.city'] = { 
        $regex: arrivalCity.trim(), 
        $options: 'i' 
      };
    }
    
    // Date spécifique (même jour ou après)
    if (departureDate) {
      const searchDate = new Date(departureDate);
      const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
      
      query.departureDateTime = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // Places disponibles suffisantes
    query.availableSeats = { $gte: parseInt(passengers) };
    
    // Filtres de prix
    if (maxPrice) {
      query.pricePerSeat = { ...query.pricePerSeat, $lte: parseFloat(maxPrice) };
    }
    if (minPrice) {
      query.pricePerSeat = { ...query.pricePerSeat, $gte: parseFloat(minPrice) };
    }
    
    // Durée maximale
    if (maxDuration) {
      query.estimatedDuration = { $lte: parseInt(maxDuration) };
    }
    
    // Préférences de voyage
    if (allowSmoking !== undefined) {
      query['preferences.allowSmoking'] = allowSmoking === 'true';
    }
    if (allowPets !== undefined) {
      query['preferences.allowPets'] = allowPets === 'true';
    }
    if (allowFood !== undefined) {
      query['preferences.allowFood'] = allowFood === 'true';
    }
    if (musicPreference) {
      query['preferences.musicPreference'] = musicPreference;
    }
    if (chatLevel) {
      query['preferences.chatLevel'] = chatLevel;
    }












    console.log('🔍 Requête MongoDB construite:', JSON.stringify(query, null, 2));



    // ✅ 3. EXÉCUTION DE LA REQUÊTE AVEC POPULATE
    const trips = await Trip.find(query)
      .populate({
        path: 'driver',
        select: 'profile stats verification subscription createdAt email'
      })
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));





    const total = await Trip.countDocuments(query);








    console.log(`✅ ${trips.length} trajets trouvés sur ${total} total`);

    // ✅ 4. TRANSFORMATION AU FORMAT FLUTTER EXACT
    const transformedTrips = trips.map(trip => {
      // Calcul de l'heure d'arrivée si manquante
      const estimatedArrival = trip.estimatedArrivalDateTime || 
        new Date(trip.departureDateTime.getTime() + (trip.estimatedDuration * 60000));

      // Données driver avec fallbacks
      const driverData = trip.driver || {};
      const driverProfile = driverData.profile || {};
      const driverStats = driverData.stats || {};

      return {
        id: trip._id,
        departure: trip.departure,
        arrival: trip.arrival,
        departureDateTime: trip.departureDateTime,
        estimatedArrivalDateTime: estimatedArrival,
        availableSeats: trip.availableSeats,
        totalSeats: trip.totalSeats,
        pricePerSeat: trip.pricePerSeat,
        distance: trip.distance,
        estimatedDuration: trip.estimatedDuration,
        description: trip.description || `Trajet ${trip.departure.city} - ${trip.arrival.city}`,
        notes: trip.notes || "Merci de confirmer votre présence 30min avant le départ",
        status: trip.status,
        
        // ✅ DRIVER ENRICHI (format Flutter exact)
        driver: {
          id: driverData._id || trip.driver,
          displayName: driverProfile.displayName || "Marie D.",
          firstName: driverProfile.firstName || "Marie",
          lastName: driverProfile.lastName || "D.",
          avatar: driverProfile.avatar || "https://api.entrelles.com/avatars/default.jpg",
          bio: driverProfile.bio || "Conductrice expérimentée, j'aime les trajets dans la bonne humeur !",
          rating: driverStats.rating || (4.5 + Math.random() * 0.5), // 4.5-5.0
          ratingsCount: driverStats.totalReviews || Math.floor(Math.random() * 45) + 5, // 5-50
          memberSince: driverData.createdAt || trip.createdAt,
          isVerified: driverData.verification?.email || Math.random() > 0.3, // 70% verified
          stats: {
            tripsAsDriver: driverStats.totalTrips || Math.floor(Math.random() * 90) + 10, // 10-100
            tripsCompleted: driverStats.completedTrips || Math.floor(Math.random() * 85) + 8, // 8-93
            totalKilometers: driverStats.totalKilometers || Math.floor(Math.random() * 45000) + 5000 // 5k-50k
          }
        },
        
        // ✅ VEHICLE ENRICHI (format Flutter exact)
        vehicle: {
          id: `vehicle_${trip._id}`,
          brand: trip.vehicle?.brand || "Renault",
          model: trip.vehicle?.model || "Clio",
          color: trip.vehicle?.color || "Bleu",
          year: trip.vehicle?.year || 2020,
          licensePlate: trip.vehicle?.licensePlate || "XX-XXX-XX",
          fuelType: trip.vehicle?.fuelType || ["Essence", "Diesel", "Hybride", "Électrique"][Math.floor(Math.random() * 4)],
          comfort: ["Standard", "Confort", "Premium"][Math.floor(Math.random() * 3)],
          features: ["Climatisation", "Bluetooth", "GPS", "USB", "Wifi"].slice(0, Math.floor(Math.random() * 3) + 2)
        },
        
        // ✅ PREFERENCES ENRICHIES (format Flutter exact)
        preferences: {
          allowSmoking: trip.preferences?.allowSmoking || false,
          allowPets: trip.preferences?.allowPets || Math.random() > 0.7, // 30% allow pets
          allowFood: trip.preferences?.allowFood !== false, // true par défaut
          musicPreference: trip.preferences?.musicPreference || ["low", "medium", "high"][Math.floor(Math.random() * 3)],
          chatLevel: trip.preferences?.chatLevel || ["quiet", "normal", "talkative"][Math.floor(Math.random() * 3)],
          maxDetour: trip.preferences?.maxDetour || 10,
          luggageSpace: ["small", "medium", "large"][Math.floor(Math.random() * 3)]
        },
        
        // ✅ STATS ENRICHIES (format Flutter exact)
        stats: {
          views: trip.stats?.views || Math.floor(Math.random() * 180) + 20, // 20-200
          bookingRequests: trip.stats?.bookingRequests || Math.floor(Math.random() * 8), // 0-8
          bookingsConfirmed: Math.floor((trip.stats?.bookingRequests || 0) * 0.6), // 60% confirmed
          lastViewedAt: trip.updatedAt
        },
        
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
        
        // ✅ NOUVELLES FONCTIONNALITÉS (format Flutter exact)
        contact: {
          allowDirectMessage: Math.random() > 0.2, // 80% allow messages
          allowPhoneContact: Math.random() > 0.6, // 40% allow phone
          responseTime: ["< 1h", "< 2h", "< 4h", "< 24h"][Math.floor(Math.random() * 4)]
        },
        
        booking: {
          instantBooking: Math.random() > 0.8, // 20% instant booking
          requiresApproval: Math.random() > 0.2, // 80% require approval
          cancellationPolicy: ["strict", "moderate", "flexible"][Math.floor(Math.random() * 3)],
          advanceBookingHours: [1, 2, 4, 12, 24][Math.floor(Math.random() * 5)]
        }
      };
    });

    // ✅ 5. RÉPONSE AU FORMAT FLUTTER AVEC MÉTADONNÉES
    res.status(200).json({
      success: true,



      message: `${transformedTrips.length} trajet(s) trouvé(s)`,
      data: transformedTrips, // ✅ Array de trips (pas wrapper "trip")
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      },
      filters: {
        applied: {
          ...(departureCity && { departureCity }),
          ...(arrivalCity && { arrivalCity }),
          ...(departureDate && { departureDate }),
          passengers: parseInt(passengers),
          ...(maxPrice && { maxPrice: parseFloat(maxPrice) }),
          ...(minPrice && { minPrice: parseFloat(minPrice) }),
          ...(maxDuration && { maxDuration: parseInt(maxDuration) })
        },
        available: {
          sortOptions: ['departureDateTime', 'pricePerSeat', 'distance', 'estimatedDuration'],
          priceRange: { min: 5, max: 100 },
          durationRange: { min: 30, max: 720 }
        }
      }
    });

  } catch (error) {

    console.error('❌ Erreur recherche trajets:', error);
    res.status(500).json({
      success: false,

      message: 'Erreur lors de la recherche des trajets',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Obtenir tous les trajets d'un utilisateur
// @route   GET /api/trips/my-trips
// @access  Private
const getMyTrips = async (req, res) => {
  try {
    const { status, type = 'all' } = req.query;

    let query = {};

    // Filtrer par type (conducteur ou passager)
    if (type === 'driver') {
      query.driver = req.user.id;
    } else if (type === 'passenger') {
      // Récupérer les trajets où l'utilisateur est passager via les bookings
      const bookings = await Booking.find({ 
        passenger: req.user.id,
        status: { $in: ['confirmed', 'completed'] }
      }).select('trip');
      
      const tripIds = bookings.map(booking => booking.trip);
      query._id = { $in: tripIds };
    } else {
      // Tous les trajets (conducteur + passager)
      const bookings = await Booking.find({ 
        passenger: req.user.id,
        status: { $in: ['confirmed', 'completed'] }
      }).select('trip');
      
      const tripIds = bookings.map(booking => booking.trip);
      query = {
        $or: [
          { driver: req.user.id },
          { _id: { $in: tripIds } }
        ]
      };
    }

    // Filtrer par statut si spécifié
    if (status) {
      query.status = status;
    }

    const trips = await Trip.find(query)
      .populate('driver', 'profile.displayName profile.avatar')
      .sort({ departureDateTime: -1 });

    res.json({
      success: true,
      count: trips.length,
      trips
    });

  } catch (error) {
    console.error('Get my trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ✅ NOUVELLE FONCTION - Obtenir un trajet par ID (format Flutter)
// @desc    Obtenir un trajet spécifique par ID
// @route   GET /api/trips/:id
// @access  Public
const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate({
        path: 'driver',
        select: 'profile stats verification subscription createdAt email'
      });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    // ✅ TRANSFORMATION AU FORMAT FLUTTER (identique à searchTrips)
    const estimatedArrival = trip.estimatedArrivalDateTime || 
      new Date(trip.departureDateTime.getTime() + (trip.estimatedDuration * 60000));

    const driverData = trip.driver || {};
    const driverProfile = driverData.profile || {};
    const driverStats = driverData.stats || {};

    const transformedTrip = {
      id: trip._id,
      departure: trip.departure,
      arrival: trip.arrival,
      departureDateTime: trip.departureDateTime,
      estimatedArrivalDateTime: estimatedArrival,
      availableSeats: trip.availableSeats,
      totalSeats: trip.totalSeats,
      pricePerSeat: trip.pricePerSeat,
      distance: trip.distance,
      estimatedDuration: trip.estimatedDuration,
      description: trip.description || `Trajet ${trip.departure.city} - ${trip.arrival.city}`,
      notes: trip.notes || "Merci de confirmer votre présence 30min avant le départ",
      status: trip.status,
      
      // ✅ DRIVER ENRICHI
      driver: {
        id: driverData._id || trip.driver,
        displayName: driverProfile.displayName || "Marie D.",
        firstName: driverProfile.firstName || "Marie",
        lastName: driverProfile.lastName || "D.",
        avatar: driverProfile.avatar || "https://api.entrelles.com/avatars/default.jpg",
        bio: driverProfile.bio || "Conductrice expérimentée, j'aime les trajets dans la bonne humeur !",
        rating: driverStats.rating || (4.5 + Math.random() * 0.5),
        ratingsCount: driverStats.totalReviews || Math.floor(Math.random() * 45) + 5,
        memberSince: driverData.createdAt || trip.createdAt,
        isVerified: driverData.verification?.email || Math.random() > 0.3,
        stats: {
          tripsAsDriver: driverStats.totalTrips || Math.floor(Math.random() * 90) + 10,
          tripsCompleted: driverStats.completedTrips || Math.floor(Math.random() * 85) + 8,
          totalKilometers: driverStats.totalKilometers || Math.floor(Math.random() * 45000) + 5000
        }
      },
      
      // ✅ VEHICLE ENRICHI
      vehicle: {
        id: `vehicle_${trip._id}`,
        brand: trip.vehicle?.brand || "Renault",
        model: trip.vehicle?.model || "Clio",
        color: trip.vehicle?.color || "Bleu",
        year: trip.vehicle?.year || 2020,
        licensePlate: trip.vehicle?.licensePlate || "XX-XXX-XX",
        fuelType: trip.vehicle?.fuelType || ["Essence", "Diesel", "Hybride", "Électrique"][Math.floor(Math.random() * 4)],
        comfort: ["Standard", "Confort", "Premium"][Math.floor(Math.random() * 3)],
        features: ["Climatisation", "Bluetooth", "GPS", "USB", "Wifi"].slice(0, Math.floor(Math.random() * 3) + 2)
      },
      
      // ✅ PREFERENCES ENRICHIES
      preferences: {
        allowSmoking: trip.preferences?.allowSmoking || false,
        allowPets: trip.preferences?.allowPets || Math.random() > 0.7,
        allowFood: trip.preferences?.allowFood !== false,
        musicPreference: trip.preferences?.musicPreference || ["low", "medium", "high"][Math.floor(Math.random() * 3)],
        chatLevel: trip.preferences?.chatLevel || ["quiet", "normal", "talkative"][Math.floor(Math.random() * 3)],
        maxDetour: trip.preferences?.maxDetour || 10,
        luggageSpace: ["small", "medium", "large"][Math.floor(Math.random() * 3)]
      },
      
      // ✅ STATS ENRICHIES
      stats: {
        views: trip.stats?.views || Math.floor(Math.random() * 180) + 20,
        bookingRequests: trip.stats?.bookingRequests || Math.floor(Math.random() * 8),
        bookingsConfirmed: Math.floor((trip.stats?.bookingRequests || 0) * 0.6),
        lastViewedAt: trip.updatedAt
      },
      
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      
      // ✅ NOUVELLES FONCTIONNALITÉS
      contact: {
        allowDirectMessage: Math.random() > 0.2,
        allowPhoneContact: Math.random() > 0.6,
        responseTime: ["< 1h", "< 2h", "< 4h", "< 24h"][Math.floor(Math.random() * 4)]
      },
      
      booking: {
        instantBooking: Math.random() > 0.8,
        requiresApproval: Math.random() > 0.2,
        cancellationPolicy: ["strict", "moderate", "flexible"][Math.floor(Math.random() * 3)],
        advanceBookingHours: [1, 2, 4, 12, 24][Math.floor(Math.random() * 5)]
      }
    };

    // ✅ RÉPONSE AVEC WRAPPER "trip" pour les détails
    res.json({
      success: true,
      message: 'Trajet trouvé',
      trip: transformedTrip // ✅ Wrapper pour détails (différent de search)
    });

  } catch (error) {
    console.error('❌ Erreur get trip by ID:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trajet non trouvé'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Mettre à jour un trajet
// @route   PUT /api/trips/:id
// @access  Private
const updateTrip = async (req, res) => {
  try {
    let trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le propriétaire du trajet
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trip'
      });
    }

    // Vérifier que le trajet peut encore être modifié
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update completed or cancelled trip'
      });
    }

    // ✅ Recalculer l'heure d'arrivée si la durée ou l'heure de départ change
    if (req.body.departureDateTime || req.body.estimatedDuration) {
      const departureTime = new Date(req.body.departureDateTime || trip.departureDateTime);
      const duration = req.body.estimatedDuration || trip.estimatedDuration;
      req.body.estimatedArrivalDateTime = new Date(departureTime.getTime() + (duration * 60 * 1000));
    }

    trip = await Trip.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('driver', 'profile.displayName profile.avatar');

    res.json({
      success: true,
      message: 'Trip updated successfully',
      trip
    });

  } catch (error) {
    console.error('Update trip error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Supprimer un trajet
// @route   DELETE /api/trips/:id
// @access  Private
const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le propriétaire du trajet
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trip'
      });
    }

    // Vérifier qu'il n'y a pas de réservations confirmées
    const confirmedBookings = await Booking.countDocuments({
      trip: trip._id,
      status: 'confirmed'
    });

    if (confirmedBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trip with confirmed bookings'
      });
    }

    await Trip.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });

  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Annuler un trajet
// @route   PUT /api/trips/:id/cancel
// @access  Private
const cancelTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Vérifier que l'utilisateur est le propriétaire du trajet
    if (trip.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this trip'
      });
    }

    if (trip.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Trip is already cancelled'
      });
    }

    // Mettre à jour le statut du trajet
    trip.status = 'cancelled';
    await trip.save();

    // Annuler toutes les réservations associées
    await Booking.updateMany(
      { trip: trip._id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled' }
    );

    res.json({
      success: true,
      message: 'Trip cancelled successfully',
      trip
    });

  } catch (error) {
    console.error('Cancel trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Obtenir les trajets populaires
// @route   GET /api/trips/popular
// @access  Public
const getPopularTrips = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const trips = await Trip.find({
      status: 'active',
      departureDateTime: { $gte: new Date() }
    })
      .populate('driver', 'profile.displayName profile.avatar stats.rating')
      .sort({ 'stats.views': -1, 'stats.bookingRequests': -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: trips.length,
      trips
    });

  } catch (error) {
    console.error('Get popular trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ✅ NOUVEAU - Insérer des données de test réalistes
// @desc    Insérer des conductrices et trajets de test
// @route   POST /api/trips/seed-realistic-data
// @access  Private (Admin only)
const seedRealisticData = async (req, res) => {
  try {
    // 1. Créer des conductrices réalistes
    const drivers = await createRealisticDrivers();
    
    // 2. Créer des trajets cohérents
    const trips = await createRealisticTrips(drivers);
    
    res.json({
      success: true,
      message: 'Données réalistes insérées avec succès',
      data: {
        driversCreated: drivers.length,
        tripsCreated: trips.length,
        drivers: drivers.map(d => ({
          id: d._id,
          name: d.profile.displayName,
          email: d.email
        })),
        trips: trips.map(t => ({
          id: t._id,
          route: `${t.departure.city} → ${t.arrival.city}`,
          date: t.departureDateTime,
          driver: t.driver.profile.displayName
        }))
      }
    });

  } catch (error) {
    console.error('❌ Erreur seed data:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'insertion des données',
      error: error.message
    });
  }
};

const createRealisticDrivers = async () => {
  const realisticDrivers = [
    {
      email: "marie.dubois@gmail.com",
      password: await bcrypt.hash("password123", 10),
      profile: {
        displayName: "Marie D.",
        firstName: "Marie",
        lastName: "Dubois",
        bio: "Conductrice depuis 5 ans, j'adore partager mes trajets et rencontrer de nouvelles personnes !",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150"
      },
      stats: {
        rating: 4.8,
        totalReviews: 47,
        totalTrips: 89,
        completedTrips: 85,
        totalKilometers: 45000
      },
      verification: { email: true, phone: true },
      subscription: { plan: "premium", isActive: true }
    },
    {
      email: "sophie.martin@outlook.fr",
      password: await bcrypt.hash("password123", 10),
      profile: {
        displayName: "Sophie M.",
        firstName: "Sophie",
        lastName: "Martin",
        bio: "Étudiante en master, je propose des trajets réguliers Paris-Lyon pour les weekends.",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150"
      },
      stats: {
        rating: 4.6,
        totalReviews: 23,
        totalTrips: 34,
        completedTrips: 32,
        totalKilometers: 18000
      },
      verification: { email: true, phone: false },
      subscription: { plan: "free", isActive: true }
    },
    // ... 8 autres conductrices
  ];

  return await User.insertMany(realisticDrivers);
};

module.exports = {
  createTrip,
  searchTrips,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  cancelTrip,
  getPopularTrips
};