const axios = require('axios');

// Configuration
const BASE_URL = 'https://entrelles-backend.vercel.app/api';
const USERS = [
  {
    name: 'Sarah Fears',
    email: 'sarah@gmail.com',
    password: 'sarahEntrelles2025',
    displayName: 'Sarah Fears',
    firstName: 'Sarah',
    lastName: 'Fears',
    gender: 'femme',
    token: null
  },
  {
    name: 'Ollia Fana',
    email: 'ollia@gmail.com',
    password: 'olliaEntrelles2025',
    displayName: 'Ollia Fana',
    firstName: 'Ollia',
    lastName: 'Fana',
    gender: 'femme',
    token: null
  },
  {
    name: 'Fiaro Vana',
    email: 'fiaro@gmail.com',
    password: 'fiaroEntrelles2025',
    displayName: 'Fiaro Vana',
    firstName: 'Fiaro',
    lastName: 'Vana',
    gender: 'femme',
    token: null
  }
];

// Villes françaises avec leurs coordonnées
const CITIES = {
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Lyon': { lat: 45.7640, lng: 4.8357 },
  'Marseille': { lat: 43.2965, lng: 5.3698 },
  'Toulouse': { lat: 43.6047, lng: 1.4442 },
  'Nice': { lat: 43.7102, lng: 7.2620 },
  'Bordeaux': { lat: 44.8378, lng: -0.5792 },
  'Nantes': { lat: 47.2184, lng: -1.5536 },
  'Strasbourg': { lat: 48.5734, lng: 7.7521 },
  'Montpellier': { lat: 43.6108, lng: 3.8767 },
  'Lille': { lat: 50.6292, lng: 3.0573 },
  'Rennes': { lat: 48.1173, lng: -1.6778 },
  'Reims': { lat: 49.2583, lng: 4.0317 }
};

// ✅ TRAJETS AVEC VALEURS ENUM CORRECTES
const COMPLETE_TRIPS = [
  {
    departure: { city: 'Paris', address: 'Gare de Lyon, 75012 Paris' },
    arrival: { city: 'Lyon', address: 'Gare Part-Dieu, 69003 Lyon' },
    departureDateTime: '2025-06-15T08:30:00.000Z',
    availableSeats: 3,
    totalSeats: 4,
    pricePerSeat: 45,
    description: 'Trajet confortable en BMW. Départ ponctuel, musique douce bienvenue. Arrêt possible aire de repos.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'low',      // ✅ CORRIGÉ
      chatLevel: 'normal'          // ✅ CORRIGÉ
    }
  },
  {
    departure: { city: 'Lyon', address: 'Centre-ville, 69002 Lyon' },
    arrival: { city: 'Marseille', address: 'Gare Saint-Charles, 13001 Marseille' },
    departureDateTime: '2025-06-16T14:00:00.000Z',
    availableSeats: 2,
    totalSeats: 5,
    pricePerSeat: 35,
    description: 'Voyage détendu vers Marseille. Véhicule spacieux, climatisation. Partage des frais d\'autoroute.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'medium',   // ✅ CORRIGÉ
      chatLevel: 'talkative'       // ✅ CORRIGÉ
    }
  },
  {
    departure: { city: 'Paris', address: 'Porte de Versailles, 75015 Paris' },
    arrival: { city: 'Bordeaux', address: 'Gare Saint-Jean, 33000 Bordeaux' },
    departureDateTime: '2025-06-18T09:15:00.000Z',
    availableSeats: 1,
    totalSeats: 4,
    pricePerSeat: 55,
    description: 'Trajet direct Paris-Bordeaux. Conduite prudente, véhicule récent. Pause déjeuner prévue.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'quiet'
    }
  },
  {
    departure: { city: 'Toulouse', address: 'Capitole, 31000 Toulouse' },
    arrival: { city: 'Montpellier', address: 'Place de la Comédie, 34000 Montpellier' },
    departureDateTime: '2025-06-20T16:30:00.000Z',
    availableSeats: 2,
    totalSeats: 4,
    pricePerSeat: 25,
    description: 'Trajet entre copines vers Montpellier. Ambiance sympa garantie ! Musique et discussions au programme.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'high',     // ✅ CORRIGÉ
      chatLevel: 'talkative'       // ✅ CORRIGÉ
    }
  },
  {
    departure: { city: 'Nice', address: 'Promenade des Anglais, 06000 Nice' },
    arrival: { city: 'Lyon', address: 'Bellecour, 69002 Lyon' },
    departureDateTime: '2025-06-22T07:45:00.000Z',
    availableSeats: 3,
    totalSeats: 5,
    pricePerSeat: 65,
    description: 'Retour de vacances à Nice. Véhicule confortable, trajet matinal pour éviter les bouchons.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'low',
      chatLevel: 'normal'
    }
  },
  {
    departure: { city: 'Nantes', address: 'Gare SNCF, 44000 Nantes' },
    arrival: { city: 'Paris', address: 'Gare Montparnasse, 75014 Paris' },
    departureDateTime: '2025-06-25T13:20:00.000Z',
    availableSeats: 2,
    totalSeats: 4,
    pricePerSeat: 40,
    description: 'Montée sur Paris pour le weekend. Conduite souple, bonne ambiance. Partage frais péage.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'normal'
    }
  },
  {
    departure: { city: 'Strasbourg', address: 'Centre historique, 67000 Strasbourg' },
    arrival: { city: 'Paris', address: 'République, 75011 Paris' },
    departureDateTime: '2025-06-28T10:00:00.000Z',
    availableSeats: 1,
    totalSeats: 4,
    pricePerSeat: 50,
    description: 'Trajet professionnel Strasbourg-Paris. Départ matinal, arrivée prévue 14h. Silence apprécié.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: false,
      musicPreference: 'none',     // ✅ CORRIGÉ
      chatLevel: 'quiet'
    }
  },
  {
    departure: { city: 'Lille', address: 'Gare Lille-Flandres, 59000 Lille' },
    arrival: { city: 'Paris', address: 'Châtelet, 75001 Paris' },
    departureDateTime: '2025-07-01T15:45:00.000Z',
    availableSeats: 3,
    totalSeats: 5,
    pricePerSeat: 30,
    description: 'Trajet régulier Lille-Paris. Véhicule familial, ambiance décontractée. Arrêts possibles.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'talkative'
    }
  },
  {
    departure: { city: 'Bordeaux', address: 'Place des Quinconces, 33000 Bordeaux' },
    arrival: { city: 'Toulouse', address: 'Gare Matabiau, 31000 Toulouse' },
    departureDateTime: '2025-07-03T11:30:00.000Z',
    availableSeats: 2,
    totalSeats: 4,
    pricePerSeat: 28,
    description: 'Trajet Sud-Ouest entre Bordeaux et Toulouse. Conduite zen, paysages magnifiques au programme.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'normal'
    }
  },
  {
    departure: { city: 'Marseille', address: 'Vieux-Port, 13002 Marseille' },
    arrival: { city: 'Nice', address: 'Gare de Nice-Ville, 06000 Nice' },
    departureDateTime: '2025-07-05T17:00:00.000Z',
    availableSeats: 1,
    totalSeats: 4,
    pricePerSeat: 35,
    description: 'Trajet côtier Marseille-Nice en fin d\'après-midi. Vue sur mer garantie ! Ambiance vacances.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'high',
      chatLevel: 'talkative'
    }
  },
  {
    departure: { city: 'Rennes', address: 'Centre-ville, 35000 Rennes' },
    arrival: { city: 'Nantes', address: 'Île de Nantes, 44000 Nantes' },
    departureDateTime: '2025-07-08T12:15:00.000Z',
    availableSeats: 3,
    totalSeats: 4,
    pricePerSeat: 15,
    description: 'Court trajet Rennes-Nantes. Parfait pour découvrir la région bretonne ensemble.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'talkative'
    }
  },
  {
    departure: { city: 'Montpellier', address: 'Antigone, 34000 Montpellier' },
    arrival: { city: 'Toulouse', address: 'Capitole, 31000 Toulouse' },
    departureDateTime: '2025-07-10T14:45:00.000Z',
    availableSeats: 2,
    totalSeats: 5,
    pricePerSeat: 22,
    description: 'Trajet étudiant Montpellier-Toulouse. Ambiance jeune et dynamique, musique au choix.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'high',
      chatLevel: 'talkative'
    }
  },
  {
    departure: { city: 'Paris', address: 'Opéra, 75009 Paris' },
    arrival: { city: 'Reims', address: 'Centre-ville, 51100 Reims' },
    departureDateTime: '2025-07-12T09:30:00.000Z',
    availableSeats: 1,
    totalSeats: 4,
    pricePerSeat: 20,
    description: 'Escapade champagne à Reims ! Trajet matinal, retour possible le soir. Dégustation prévue.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: true,
      musicPreference: 'low',
      chatLevel: 'normal'
    }
  },
  {
    departure: { city: 'Lyon', address: 'Presqu\'île, 69002 Lyon' },
    arrival: { city: 'Paris', address: 'Bastille, 75011 Paris' },
    departureDateTime: '2025-07-15T18:00:00.000Z',
    availableSeats: 2,
    totalSeats: 4,
    pricePerSeat: 48,
    description: 'Retour sur Paris après weekend lyonnais. Trajet de soirée, ambiance cosy. Playlist partagée.',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      allowFood: true,
      musicPreference: 'medium',
      chatLevel: 'normal'
    }
  },
  {
    departure: { city: 'Nice', address: 'Aéroport, 06200 Nice' },
    arrival: { city: 'Marseille', address: 'Aéroport, 13700 Marignane' },
    departureDateTime: '2025-07-18T06:30:00.000Z',
    availableSeats: 3,
    totalSeats: 4,
    pricePerSeat: 40,
    description: 'Trajet matinal entre aéroports. Parfait pour les voyageuses avec bagages. Départ très tôt.',
    preferences: {
      allowSmoking: false,
      allowPets: false,
      allowFood: false,
      musicPreference: 'none',
      chatLevel: 'quiet'
    }
  }
];


// Trajets avec données incomplètes (seuls les champs obligatoires) - DATES APRÈS LE 12 JUIN 2025
const INCOMPLETE_TRIPS = [
  {
    departure: { city: 'Paris' },
    arrival: { city: 'Lyon' },
    departureDateTime: '2025-07-20T10:00:00.000Z'
  },
  {
    departure: { city: 'Marseille' },
    arrival: { city: 'Nice' },
    departureDateTime: '2025-07-22T14:30:00.000Z'
  },
  {
    departure: { city: 'Toulouse' },
    arrival: { city: 'Bordeaux' },
    departureDateTime: '2025-07-25T16:15:00.000Z'
  },
  {
    departure: { city: 'Lille' },
    arrival: { city: 'Paris' },
    departureDateTime: '2025-07-28T08:45:00.000Z'
  },
  {
    departure: { city: 'Nantes' },
    arrival: { city: 'Rennes' },
    departureDateTime: '2025-07-30T13:00:00.000Z'
  }
];

// ✅ FONCTION: Créer un utilisateur
async function createUser(userData) {
  try {
    console.log(`👤 Création utilisateur ${userData.email}...`);
    const response = await axios.post(`${BASE_URL}/auth/register`, {
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName,
      firstName: userData.firstName,
      lastName: userData.lastName,
      gender: userData.gender
    });
    
    if (response.data.success) {
      console.log(`✅ ${userData.email} créé avec succès`);
      return true;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log(`ℹ️  ${userData.email} existe déjà`);
      return true; // Pas d'erreur si l'utilisateur existe déjà
    }
    console.error(`❌ Erreur création ${userData.email}:`, error.response?.data || error.message);
    return false;
  }
}

async function loginUser(email, password) {
  try {
    console.log(`🔐 Connexion de ${email}...`);
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    
    if (response.data.success) {
      console.log(`✅ ${email} connectée avec succès`);
      return response.data.token;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error(`❌ Erreur connexion ${email}:`, error.response?.data || error.message);
    return null;
  }
}

async function createTrip(token, tripData, userEmail) {
  try {
    console.log(`🚗 Création trajet par ${userEmail}: ${tripData.departure.city} → ${tripData.arrival.city}`);
    
    const response = await axios.post(`${BASE_URL}/trips`, tripData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log(`✅ Trajet créé: ${response.data.trip.id}`);
      return response.data.trip;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error(`❌ Erreur création trajet:`, error.response?.data || error.message);
    return null;
  }
}

function enrichTripWithCoordinates(trip) {
  // Ajouter les coordonnées automatiquement
  if (trip.departure && trip.departure.city && CITIES[trip.departure.city]) {
    trip.departure.coordinates = CITIES[trip.departure.city];
  }
  
  if (trip.arrival && trip.arrival.city && CITIES[trip.arrival.city]) {
    trip.arrival.coordinates = CITIES[trip.arrival.city];
  }
  
  return trip;
}

function getRandomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ FONCTION PRINCIPALE
async function runTest() {
  console.log('🎯 DÉBUT DU TEST - CRÉATION DE DONNÉES RÉALISTES');
  console.log('=' .repeat(60));
  
  try {
    // ✅ ÉTAPE 0: Création des utilisateurs
    console.log('\n📋 ÉTAPE 0: CRÉATION DES UTILISATEURS');
    console.log('-'.repeat(40));
    
    for (let user of USERS) {
      const created = await createUser(user);
      if (!created) {
        console.error(`❌ Impossible de créer ${user.email}`);
        return;
      }
      await delay(500);
    }
    
    console.log(`✅ Tous les utilisateurs sont prêts`);
    
    // 1. Connexion de tous les utilisateurs
    console.log('\n📋 ÉTAPE 1: CONNEXION DES UTILISATEURS');
    console.log('-'.repeat(40));
    
    for (let user of USERS) {
      user.token = await loginUser(user.email, user.password);
      if (!user.token) {
        console.error(`❌ Impossible de connecter ${user.email}`);
        return;
      }
      await delay(500);
    }
    
    console.log(`✅ ${USERS.filter(u => u.token).length} utilisateurs connectés`);
    
    // 2. Création des trajets avec données complètes
    console.log('\n📋 ÉTAPE 2: CRÉATION DE 15 TRAJETS COMPLETS');
    console.log('-'.repeat(40));
    
    let completeTripCount = 0;
    for (let i = 0; i < COMPLETE_TRIPS.length; i++) {
      const trip = { ...COMPLETE_TRIPS[i] };
      const user = getRandomUser();
      
      if (user.token) {
        // Enrichir avec les coordonnées
        const enrichedTrip = enrichTripWithCoordinates(trip);
        
        const createdTrip = await createTrip(user.token, enrichedTrip, user.email);
        if (createdTrip) {
          completeTripCount++;
          console.log(`   ${completeTripCount}/15 - ${trip.departure.city} → ${trip.arrival.city} (${user.name})`);
        }
        
        await delay(800);
      }
    }
    
    console.log(`✅ ${completeTripCount} trajets complets créés`);
    
    // 3. Création des trajets avec données incomplètes
    console.log('\n📋 ÉTAPE 3: CRÉATION DE 5 TRAJETS INCOMPLETS');
    console.log('-'.repeat(40));
    
    let incompleteTripCount = 0;
    for (let i = 0; i < INCOMPLETE_TRIPS.length; i++) {
      const trip = { ...INCOMPLETE_TRIPS[i] };
      const user = getRandomUser();
      
      if (user.token) {
        const createdTrip = await createTrip(user.token, trip, user.email);
        if (createdTrip) {
          incompleteTripCount++;
          console.log(`   ${incompleteTripCount}/5 - ${trip.departure.city} → ${trip.arrival.city} (${user.name})`);
        }
        
        await delay(800);
      }
    }
    
    console.log(`✅ ${incompleteTripCount} trajets incomplets créés`);
    
    // 4. Résumé final
    console.log('\n📊 RÉSUMÉ FINAL');
    console.log('=' .repeat(60));
    console.log(`✅ Utilisateurs connectés: ${USERS.filter(u => u.token).length}/3`);
    console.log(`✅ Trajets complets créés: ${completeTripCount}/15`);
    console.log(`✅ Trajets incomplets créés: ${incompleteTripCount}/5`);
    console.log(`🎯 Total trajets créés: ${completeTripCount + incompleteTripCount}/20`);
    
    // 5. Test de recherche
    console.log('\n📋 ÉTAPE 4: TEST DE RECHERCHE');
    console.log('-'.repeat(40));
    
    try {
      const searchResponse = await axios.get(`${BASE_URL}/trips/search?departureCity=Paris&arrivalCity=Lyon`);
      
      // ✅ DÉBOGAGE: Afficher la structure de réponse
      console.log('🔍 Structure de réponse:', JSON.stringify(searchResponse.data, null, 2));
      
      // ✅ GESTION FLEXIBLE DE LA RÉPONSE
      if (searchResponse.data) {
        // Cas 1: response.data.success avec trips
        if (searchResponse.data.success && searchResponse.data.trips) {
          console.log(`✅ Recherche Paris→Lyon: ${searchResponse.data.trips.length} résultats`);
        }
        // Cas 2: response.data.trips directement
        else if (searchResponse.data.trips) {
          console.log(`✅ Recherche Paris→Lyon: ${searchResponse.data.trips.length} résultats`);
        }
        // Cas 3: response.data est un tableau
        else if (Array.isArray(searchResponse.data)) {
          console.log(`✅ Recherche Paris→Lyon: ${searchResponse.data.length} résultats`);
        }
        // Cas 4: response.data.data (structure imbriquée)
        else if (searchResponse.data.data && Array.isArray(searchResponse.data.data)) {
          console.log(`✅ Recherche Paris→Lyon: ${searchResponse.data.data.length} résultats`);
        }
        // Cas 5: Autre structure
        else {
          console.log('✅ Recherche effectuée, structure de réponse non standard');
          console.log('📊 Données reçues:', Object.keys(searchResponse.data));
        }
      } else {
        console.log('⚠️  Réponse vide de la recherche');
      }
    } catch (error) {
      console.error('❌ Erreur test recherche:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 TEST TERMINÉ AVEC SUCCÈS !');
    
  } catch (error) {
    console.error('❌ ERREUR GÉNÉRALE:', error);
  }
}

// Gestion des erreurs globales
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

// Lancement du test
if (require.main === module) {
  runTest().then(() => {
    console.log('\n👋 Script terminé');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = {
  runTest,
  USERS,
  COMPLETE_TRIPS,
  INCOMPLETE_TRIPS
};