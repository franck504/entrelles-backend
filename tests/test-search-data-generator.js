const axios = require('axios');

// const BASE_URL = 'http://localhost:3000/api'; 
const BASE_URL = 'https://entrelles-backend.vercel.app/api';

// Configuration axios
axios.defaults.withCredentials = true;

// Fonction utilitaire pour les logs colorés
const log = {
  info: (msg) => console.log(`\n🔵 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  data: (msg, data) => console.log(`📊 ${msg}:`, JSON.stringify(data, null, 2))
};

// Données des 3 utilisatrices
const users = [
  {
    email: `marie.dupont.${Date.now()}@gmail.com`,
    password: 'MarieSecure2024!',
    displayName: 'Marie Dupont',
    firstName: 'Marie',
    lastName: 'Dupont',
    phone: '+33123456789'
  },
  {
    email: `sophie.martin.${Date.now()}@gmail.com`,
    password: 'SophieStrong2024#',
    displayName: 'Sophie Martin',
    firstName: 'Sophie',
    lastName: 'Martin',
    phone: '+33987654321'
  },
  {
    email: `claire.bernard.${Date.now()}@gmail.com`,
    password: 'ClairePower2024$',
    displayName: 'Claire Bernard',
    firstName: 'Claire',
    lastName: 'Bernard',
    phone: '+33456789123'
  }
];

// Données des 10 trajets variés
const tripsData = [
  {
    departure: { city: 'Paris', address: 'Gare du Nord, 75010 Paris', coordinates: { lat: 48.8809, lng: 2.3553 }, postalCode: '75010' },
    arrival: { city: 'Lyon', address: 'Gare Part-Dieu, 69003 Lyon', coordinates: { lat: 45.7603, lng: 4.8584 }, postalCode: '69003' },
    departureDateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Demain
    estimatedDuration: 270, availableSeats: 3, pricePerSeat: 25.00, distance: 465,
    vehicle: { brand: 'Renault', model: 'Clio', color: 'Rouge', licensePlate: 'AB-123-CD', year: 2020 },
    description: 'Trajet Paris-Lyon, départ matinal'
  },
  {
    departure: { city: 'Lyon', address: 'Gare Part-Dieu, 69003 Lyon', coordinates: { lat: 45.7603, lng: 4.8584 }, postalCode: '69003' },
    arrival: { city: 'Marseille', address: 'Gare Saint-Charles, 13001 Marseille', coordinates: { lat: 43.3026, lng: 5.3811 }, postalCode: '13001' },
    departureDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Après-demain
    estimatedDuration: 180, availableSeats: 2, pricePerSeat: 20.00, distance: 315,
    vehicle: { brand: 'Peugeot', model: '308', color: 'Bleu', licensePlate: 'CD-456-EF', year: 2021 },
    description: 'Trajet Lyon-Marseille, après-midi'
  },
  {
    departure: { city: 'Paris', address: 'Châtelet-Les Halles, 75001 Paris', coordinates: { lat: 48.8619, lng: 2.3467 }, postalCode: '75001' },
    arrival: { city: 'Toulouse', address: 'Gare Matabiau, 31000 Toulouse', coordinates: { lat: 43.6108, lng: 1.4538 }, postalCode: '31000' },
    departureDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Dans 3 jours
    estimatedDuration: 360, availableSeats: 4, pricePerSeat: 35.00, distance: 678,
    vehicle: { brand: 'Citroën', model: 'C4', color: 'Blanc', licensePlate: 'EF-789-GH', year: 2019 },
    description: 'Trajet Paris-Toulouse, longue distance'
  },
  {
    departure: { city: 'Marseille', address: 'Vieux-Port, 13001 Marseille', coordinates: { lat: 43.2965, lng: 5.3698 }, postalCode: '13001' },
    arrival: { city: 'Nice', address: 'Gare de Nice-Ville, 06000 Nice', coordinates: { lat: 43.7034, lng: 7.2663 }, postalCode: '06000' },
    departureDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // Dans 4 jours
    estimatedDuration: 150, availableSeats: 1, pricePerSeat: 18.00, distance: 200,
    vehicle: { brand: 'Volkswagen', model: 'Golf', color: 'Gris', licensePlate: 'GH-012-IJ', year: 2022 },
    description: 'Trajet Marseille-Nice, côte d\'Azur'
  },
  {
    departure: { city: 'Lyon', address: 'Bellecour, 69002 Lyon', coordinates: { lat: 45.7578, lng: 4.8320 }, postalCode: '69002' },
    arrival: { city: 'Paris', address: 'Gare de Lyon, 75012 Paris', coordinates: { lat: 48.8447, lng: 2.3743 }, postalCode: '75012' },
    departureDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // Dans 5 jours
    estimatedDuration: 280, availableSeats: 2, pricePerSeat: 28.00, distance: 465,
    vehicle: { brand: 'Audi', model: 'A3', color: 'Noir', licensePlate: 'IJ-345-KL', year: 2020 },
    description: 'Retour Lyon-Paris, soirée'
  },
  {
    departure: { city: 'Toulouse', address: 'Capitole, 31000 Toulouse', coordinates: { lat: 43.6043, lng: 1.4437 }, postalCode: '31000' },
    arrival: { city: 'Bordeaux', address: 'Gare Saint-Jean, 33000 Bordeaux', coordinates: { lat: 44.8262, lng: -0.5560 }, postalCode: '33000' },
    departureDateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // Dans 6 jours
    estimatedDuration: 120, availableSeats: 3, pricePerSeat: 15.00, distance: 245,
    vehicle: { brand: 'Ford', model: 'Focus', color: 'Rouge', licensePlate: 'KL-678-MN', year: 2021 },
    description: 'Trajet Toulouse-Bordeaux, matinée'
  },
  {
    departure: { city: 'Paris', address: 'République, 75003 Paris', coordinates: { lat: 48.8676, lng: 2.3631 }, postalCode: '75003' },
    arrival: { city: 'Nantes', address: 'Gare de Nantes, 44000 Nantes', coordinates: { lat: 47.2173, lng: -1.5534 }, postalCode: '44000' },
    departureDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Dans 7 jours
    estimatedDuration: 210, availableSeats: 2, pricePerSeat: 22.00, distance: 385,
    vehicle: { brand: 'Opel', model: 'Corsa', color: 'Vert', licensePlate: 'MN-901-OP', year: 2019 },
    description: 'Trajet Paris-Nantes, week-end'
  },
  {
    departure: { city: 'Nice', address: 'Promenade des Anglais, 06000 Nice', coordinates: { lat: 43.6951, lng: 7.2658 }, postalCode: '06000' },
    arrival: { city: 'Lyon', address: 'Presqu\'île, 69001 Lyon', coordinates: { lat: 45.7640, lng: 4.8357 }, postalCode: '69001' },
    departureDateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // Dans 8 jours
    estimatedDuration: 300, availableSeats: 4, pricePerSeat: 32.00, distance: 470,
    vehicle: { brand: 'BMW', model: 'Série 1', color: 'Bleu', licensePlate: 'OP-234-QR', year: 2022 },
    description: 'Trajet Nice-Lyon, retour vacances'
  },
  {
    departure: { city: 'Bordeaux', address: 'Place de la Bourse, 33000 Bordeaux', coordinates: { lat: 44.8404, lng: -0.5805 }, postalCode: '33000' },
    arrival: { city: 'Paris', address: 'Montparnasse, 75014 Paris', coordinates: { lat: 48.8422, lng: 2.3219 }, postalCode: '75014' },
    departureDateTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(), // Dans 9 jours
    estimatedDuration: 330, availableSeats: 1, pricePerSeat: 40.00, distance: 580,
    vehicle: { brand: 'Mercedes', model: 'Classe A', color: 'Argent', licensePlate: 'QR-567-ST', year: 2021 },
    description: 'Trajet Bordeaux-Paris, confort'
  },
  {
    departure: { city: 'Nantes', address: 'Île Feydeau, 44000 Nantes', coordinates: { lat: 47.2127, lng: -1.5541 }, postalCode: '44000' },
    arrival: { city: 'Rennes', address: 'Gare de Rennes, 35000 Rennes', coordinates: { lat: 48.1030, lng: -1.6720 }, postalCode: '35000' },
    departureDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Dans 10 jours
    estimatedDuration: 90, availableSeats: 3, pricePerSeat: 12.00, distance: 110,
    vehicle: { brand: 'Skoda', model: 'Fabia', color: 'Jaune', licensePlate: 'ST-890-UV', year: 2020 },
    description: 'Trajet Nantes-Rennes, courte distance'
  }
];

async function generateTestData() {
  const createdUsers = [];
  const createdTrips = [];
  const searchTestCases = [];

  try {
    log.info('🚀 GÉNÉRATION DES DONNÉES DE TEST POUR LA RECHERCHE');
    console.log('=' .repeat(60));

    // ========================================
    // 1. CRÉATION DES 3 UTILISATRICES
    // ========================================
    log.info('1️⃣  CRÉATION DES UTILISATRICES');

    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      
      log.info(`Inscription de ${userData.displayName}...`);
      
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        gender: 'femme',
        phone: userData.phone
      });
      
      if (registerResponse.status === 201) {
        const user = {
          ...userData,
          id: registerResponse.data.user.id,
          token: registerResponse.data.token
        };
        createdUsers.push(user);
        log.success(`${userData.displayName} créée - ID: ${user.id}`);
      }
    }

    // ========================================
    // 2. CRÉATION DES 10 TRAJETS
    // ========================================
    log.info('2️⃣  CRÉATION DES TRAJETS');

    for (let i = 0; i < tripsData.length; i++) {
      const tripData = tripsData[i];
      const userIndex = i % createdUsers.length; // Répartir les trajets entre les utilisatrices
      const user = createdUsers[userIndex];
      
      log.info(`Création trajet ${i + 1}: ${tripData.departure.city} → ${tripData.arrival.city} par ${user.displayName}`);
      
      try {
        const tripResponse = await axios.post(`${BASE_URL}/trips`, tripData, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (tripResponse.status === 201) {
          const trip = {
            ...tripResponse.data.trip,
            driverName: user.displayName,
            driverEmail: user.email
          };
          createdTrips.push(trip);
          log.success(`Trajet créé - ID: ${trip._id}`);
        }
      } catch (error) {
        log.error(`Erreur création trajet ${i + 1}: ${error.response?.data?.message || error.message}`);
      }
    }

    // ========================================
    // 3. GÉNÉRATION DES CAS DE TEST RECHERCHE
    // ========================================
    log.info('3️⃣  GÉNÉRATION DES CAS DE TEST RECHERCHE');

    // Extraire les routes uniques des trajets créés
    const routes = createdTrips.map(trip => ({
      departureCity: trip.departure.city,
      arrivalCity: trip.arrival.city,
      departureDate: trip.departureDateTime.split('T')[0],
      availableSeats: trip.availableSeats,
      pricePerSeat: trip.pricePerSeat,
      tripId: trip._id
    }));

    // Créer des cas de test de recherche
    const uniqueRoutes = [...new Map(routes.map(r => [`${r.departureCity}-${r.arrivalCity}`, r])).values()];
    
    uniqueRoutes.forEach((route, index) => {
      searchTestCases.push({
        testName: `Test ${index + 1}: ${route.departureCity} → ${route.arrivalCity}`,
        searchUrl: `${BASE_URL}/trips/search?departureCity=${encodeURIComponent(route.departureCity)}&arrivalCity=${encodeURIComponent(route.arrivalCity)}&departureDate=${route.departureDate}&passengers=1`,
        expectedResults: routes.filter(r => 
          r.departureCity === route.departureCity && 
          r.arrivalCity === route.arrivalCity
        ).length
      });
    });

    // ========================================
    // 4. AFFICHAGE DES RÉSULTATS
    // ========================================
    console.log('\n' + '='.repeat(80));
    log.success('🎉 DONNÉES DE TEST GÉNÉRÉES AVEC SUCCÈS !');
    console.log('='.repeat(80));

    // Résumé des utilisatrices
    log.info('👥 UTILISATRICES CRÉÉES:');
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.displayName} (${user.email})`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Mot de passe: ${user.password}`);
      console.log(`   📱 Téléphone: ${user.phone}`);
      console.log(`   🆔 ID: ${user.id}`);
      console.log(`   🎫 Token: ${user.token.substring(0, 20)}...`);
      console.log('');
    });

    // Résumé des trajets
    log.info('🚗 TRAJETS CRÉÉS:');
    createdTrips.forEach((trip, index) => {
      console.log(`${index + 1}. ${trip.departure.city} → ${trip.arrival.city}`);
      console.log(`   👩‍💼 Conductrice: ${trip.driverName}`);
      console.log(`   📅 Date: ${new Date(trip.departureDateTime).toLocaleDateString('fr-FR')}`);
      console.log(`   🕐 Heure: ${new Date(trip.departureDateTime).toLocaleTimeString('fr-FR')}`);
      console.log(`   💺 Places: ${trip.availableSeats}/${trip.totalSeats}`);
      console.log(`   💰 Prix: ${trip.pricePerSeat}€`);
      console.log(`   🆔 ID: ${trip._id}`);
      console.log('');
    });

    // ========================================
    // 5. CAS DE TEST POUR POSTMAN
    // ========================================
    console.log('\n' + '='.repeat(80));
    log.info('📮 CAS DE TEST POUR POSTMAN:');
    console.log('='.repeat(80));

    searchTestCases.forEach((testCase, index) => {
      console.log(`\n${testCase.testName}`);
      console.log(`URL: ${testCase.searchUrl}`);
      console.log(`Résultats attendus: ${testCase.expectedResults} trajet(s)`);
      console.log('-'.repeat(50));
    });

    // ========================================
    // 6. TESTS DE RECHERCHE AUTOMATIQUES
    // ========================================
    log.info('🔍 TESTS DE RECHERCHE AUTOMATIQUES:');

    for (const testCase of searchTestCases) {
      try {
        log.info(`Test: ${testCase.testName}`);
        const searchResponse = await axios.get(testCase.searchUrl);
        
        if (searchResponse.status === 200) {
          const foundTrips = searchResponse.data.trips || searchResponse.data.data || [];
          log.success(`✅ ${foundTrips.length} trajet(s) trouvé(s) (attendu: ${testCase.expectedResults})`);
          
          foundTrips.forEach((trip, index) => {
            console.log(`   ${index + 1}. ${trip.departure.city} → ${trip.arrival.city} - ${trip.pricePerSeat}€ - ${trip.availableSeats} places`);
          });
        }
      } catch (error) {
        log.error(`❌ Erreur test: ${error.response?.data?.message || error.message}`);
      }
      console.log('');
    }

    // ========================================
    // 7. COLLECTION POSTMAN GÉNÉRÉE
    // ========================================
    const postmanCollection = {
      info: {
        name: "Entrelles - Tests de Recherche",
        description: "Collection générée automatiquement pour tester la recherche de trajets"
      },
      variable: [
        {
          key: "BASE_URL",
          value: BASE_URL
        }
      ],
      item: searchTestCases.map((testCase, index) => ({
        name: testCase.testName,
        request: {
          method: "GET",
          header: [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          url: {
            raw: testCase.searchUrl,
            protocol: "https",
            host: BASE_URL.replace('https://', '').replace('http://', '').split('/'),
            path: ["api", "trips", "search"],
            query: new URL(testCase.searchUrl).searchParams.toString().split('&').map(param => {
              const [key, value] = param.split('=');
              return { key: decodeURIComponent(key), value: decodeURIComponent(value) };
            })
          }
        }
      }))
    };

    console.log('\n' + '='.repeat(80));
    log.info('📋 COLLECTION POSTMAN (Copier-coller dans Postman):');
    console.log('='.repeat(80));
    console.log(JSON.stringify(postmanCollection, null, 2));

    // ========================================
    // 8. DONNÉES POUR TESTS MANUELS
    // ========================================
    console.log('\n' + '='.repeat(80));
    log.info('🧪 DONNÉES POUR TESTS MANUELS:');
    console.log('='.repeat(80));

    console.log('\n📧 COMPTES DE TEST:');
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email} | Mot de passe: ${user.password}`);
    });

    console.log('\n🔍 RECHERCHES À TESTER:');
    const manualTests = [
      { from: 'Paris', to: 'Lyon', date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { from: 'Lyon', to: 'Marseille', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { from: 'Paris', to: 'Toulouse', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { from: 'Marseille', to: 'Nice', date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
    ];

    manualTests.forEach((test, index) => {
      const url = `${BASE_URL}/trips/search?departureCity=${test.from}&arrivalCity=${test.to}&departureDate=${test.date}&passengers=1`;
      console.log(`${index + 1}. ${test.from} → ${test.to} (${test.date})`);
      console.log(`   URL: ${url}`);
      console.log('');
    });

    return {
      users: createdUsers,
      trips: createdTrips,
      searchTests: searchTestCases,
      postmanCollection
    };

  } catch (error) {
    log.error(`Erreur générale: ${error.message}`);
    if (error.response) {
      log.error(`Détails: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

// Exécution du script
if (require.main === module) {
  generateTestData()
    .then((result) => {
      log.success(`\n🎯 GÉNÉRATION TERMINÉE !`);
      log.success(`✅ ${result.users.length} utilisatrices créées`);
      log.success(`✅ ${result.trips.length} trajets créés`);
      log.success(`✅ ${result.searchTests.length} cas de test générés`);
      console.log('\n🚀 Vous pouvez maintenant tester la recherche avec les URLs ci-dessus !');
    })
    .catch((error) => {
      log.error('❌ Échec de la génération des données de test');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateTestData };