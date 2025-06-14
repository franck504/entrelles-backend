const axios = require('axios');

const BASE_URL = 'https://entrelles-backend.vercel.app/api';

// Liste des villes avec coordonnées et code postal
const CITIES = {
  Paris: { lat: 48.8566, lng: 2.3522, postalCode: '75010' },
  Lyon: { lat: 45.7640, lng: 4.8357, postalCode: '69003' },
  Marseille: { lat: 43.2965, lng: 5.3698, postalCode: '13001' },
  Toulouse: { lat: 43.6047, lng: 1.4442, postalCode: '31000' },
  Nice: { lat: 43.7102, lng: 7.2620, postalCode: '06000' },
  Bordeaux: { lat: 44.8378, lng: -0.5792, postalCode: '33000' },
  Nantes: { lat: 47.2184, lng: -1.5536, postalCode: '44000' },
  Strasbourg: { lat: 48.5734, lng: 7.7521, postalCode: '67000' },
  Montpellier: { lat: 43.6108, lng: 3.8767, postalCode: '34000' },
  Lille: { lat: 50.6292, lng: 3.0573, postalCode: '59000' },
  Rennes: { lat: 48.1173, lng: -1.6778, postalCode: '35000' },
  Reims: { lat: 49.2583, lng: 4.0317, postalCode: '51100' }
};
const CITY_NAMES = Object.keys(CITIES);

// 1. Génération de 15 utilisateurs fictifs
const USERS = Array.from({ length: 15 }).map((_, i) => {
  const firstName = `User${i + 1}`;
  const lastName = `Test${i + 1}`;
  return {
    name: `${firstName} ${lastName}`,
    email: `user${i + 1}@testmail.com`,
    password: `TestUser${i + 1}@2025`,
    displayName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    gender: 'femme',
    token: null
  };
});

// 2. Fonctions utilitaires pour randomisation
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// date aléatoire entre deux dates
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// 3. Générer 15 trajets variés
function generateTrips() {
  const trips = [];
  const startDate = new Date(Date.UTC(2025, 5, 13)); // 13 juin 2025 UTC
  const endDate = new Date(Date.UTC(2025, 7, 31));   // jusqu'au 31 août 2025 UTC
  for (let i = 0; i < 15; i++) {
    // Sélection départ/arrivée distincts
    let depCity, arrCity;
    do {
      depCity = randomChoice(CITY_NAMES);
      arrCity = randomChoice(CITY_NAMES);
    } while (arrCity === depCity);

    const depInfo = CITIES[depCity];
    const arrInfo = CITIES[arrCity];

    // Adresse générique
    const depAddress = `Gare de ${depCity}`;
    const arrAddress = `Gare de ${arrCity}`;

    // Date de départ aléatoire après 12 juin 2025, entre 6h et 20h UTC
    const depDate = randomDate(startDate, endDate);
    depDate.setUTCHours(randomInt(6, 20), randomChoice([0, 15, 30, 45]), 0, 0);
    // Durée aléatoire entre 2h et 8h
    const durationMin = randomInt(120, 480);
    const arrDate = new Date(depDate.getTime() + durationMin * 60000);

    // Sièges
    const totalSeats = randomInt(2, 5);
    const availableSeats = randomInt(1, totalSeats - 1);

    // Prix basé sur distance simulée: distance aléatoire entre 100km et 800km
    const distance = parseFloat((randomInt(100, 800) + Math.random()).toFixed(1));
    // Prix entre 0.05€ et 0.15€ par km
    const pricePerSeat = parseFloat((distance * (0.05 + Math.random() * 0.1) / availableSeats).toFixed(2));

    // Préférences aléatoires
    const musicOptions = ['none', 'low', 'medium', 'high'];
    const chatOptions = ['quiet', 'normal', 'talkative'];
    const trip = {
      departure: {
        city: depCity,
        address: depAddress,
        coordinates: { lat: depInfo.lat, lng: depInfo.lng },
        postalCode: depInfo.postalCode
      },
      arrival: {
        city: arrCity,
        address: arrAddress,
        coordinates: { lat: arrInfo.lat, lng: arrInfo.lng },
        postalCode: arrInfo.postalCode
      },
      departureDateTime: depDate.toISOString(),
      estimatedArrivalDateTime: arrDate.toISOString(),
      availableSeats,
      totalSeats,
      pricePerSeat,
      distance,
      estimatedDuration: durationMin,
      description: `Trajet test ${i + 1}: ${depCity} → ${arrCity}.`,
      notes: 'Merci de confirmer votre présence 30min avant le départ',
      status: 'active',
      preferences: {
        allowSmoking: Math.random() < 0.2,
        allowPets: Math.random() < 0.3,
        allowFood: Math.random() < 0.8,
        musicPreference: randomChoice(musicOptions),
        chatLevel: randomChoice(chatOptions),
        maxDetour: randomInt(5, 20),
        luggageSpace: randomChoice(['small', 'medium', 'large'])
      },
      contact: {
        allowDirectMessage: true,
        allowPhoneContact: Math.random() < 0.5,
        responseTime: "< 2h"
      },
      booking: {
        instantBooking: Math.random() < 0.5,
        requiresApproval: Math.random() < 0.5,
        cancellationPolicy: randomChoice(['flexible', 'moderate', 'strict']),
        advanceBookingHours: randomInt(1, 24)
      }
    };
    trips.push(trip);
  }
  return trips;
}

async function createUser(user) {
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender
    });
    console.log(`✅ Utilisateur créé: ${user.email}`);
    return true;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log(`ℹ️ Utilisateur déjà existant: ${user.email}`);
      return true;
    }
    console.error(`❌ Erreur création ${user.email}:`, error.response?.data || error.message);
    return false;
  }
}

async function loginUser(user) {
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: user.email,
      password: user.password
    });
    user.token = res.data.token;
    console.log(`✅ Connecté: ${user.email}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur connexion ${user.email}:`, error.response?.data || error.message);
    return false;
  }
}

async function createTrip(user, trip) {
  try {
    const res = await axios.post(`${BASE_URL}/trips`, trip, {
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`🚗 Trajet créé par ${user.email}: ${trip.departure.city}→${trip.arrival.city}`);
  } catch (error) {
    console.error(`❌ Erreur création trajet (${user.email}):`, error.response?.data || error.message);
  }
}

async function run() {
  console.log('🚀 DÉMARRAGE DU TEST DE 15 UTILISATEURS + 15 TRAJETS VARIÉS');

  // 1. Création et connexion des utilisateurs
  for (const user of USERS) {
    const created = await createUser(user);
    if (created) {
      await loginUser(user);
    }
  }

  // 2. Génération des trajets
  const trips = generateTrips();

  // 3. Création des trajets : on associe chaque trajet à un utilisateur différent
  for (let i = 0; i < trips.length; i++) {
    const user = USERS[i];
    if (user.token) {
      await createTrip(user, trips[i]);
    }
  }

  console.log('✅ FIN DU SCRIPT DE TEST');
}

run();
