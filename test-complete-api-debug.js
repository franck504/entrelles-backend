const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api'; // ✅ Port 3000

// Variables globales
let aliceToken = '';
let marieToken = '';
let aliceId = '';
let marieId = '';
let tripId = '';
let bookingId = '';

const log = {
  info: (msg) => console.log(`\n🔵 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  debug: (msg, data) => console.log(`🔍 DEBUG ${msg}:`, JSON.stringify(data, null, 2))
};

async function runDebugTests() {
  try {
    // 1. Inscription Alice
    log.info('Inscription d\'Alice...');
    const aliceEmail = `alice${Date.now()}@example.com`;
    const aliceRegister = await axios.post(`${BASE_URL}/auth/register`, {
      email: aliceEmail,
      password: 'Password123',
      displayName: 'Alice Conductrice',
      firstName: 'Alice',
      lastName: 'Martin',
      gender: 'femme'
    });
    
    aliceToken = aliceRegister.data.token;
    aliceId = aliceRegister.data.user.id;
    log.success(`Alice inscrite - ID: ${aliceId}`);
    log.debug('Alice Token', aliceToken.substring(0, 20) + '...');

    // 2. Inscription Marie
    log.info('Inscription de Marie...');
    const marieEmail = `marie${Date.now()}@example.com`;
    const marieRegister = await axios.post(`${BASE_URL}/auth/register`, {
      email: marieEmail,
      password: 'Password123',
      displayName: 'Marie Passagère',
      firstName: 'Marie',
      lastName: 'Dupont',
      gender: 'femme'
    });
    
    marieToken = marieRegister.data.token;
    marieId = marieRegister.data.user.id;
    log.success(`Marie inscrite - ID: ${marieId}`);

    // 3. Création trajet par Alice
    log.info('Création d\'un trajet par Alice...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const tripData = {
      departure: {
        city: 'Paris',
        address: 'Gare du Nord',
        coordinates: { lat: 48.8809, lng: 2.3553 }
      },
      arrival: {
        city: 'Lyon',
        address: 'Gare Part-Dieu',
        coordinates: { lat: 45.7603, lng: 4.8584 }
      },
      departureDateTime: tomorrow.toISOString(),
      estimatedDuration: 300,
      availableSeats: 3,
      pricePerSeat: 25.50,
      distance: 465,
      description: 'Trajet test Paris-Lyon'
    };

    const createTrip = await axios.post(`${BASE_URL}/trips`, tripData, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    
    tripId = createTrip.data.trip._id;
    log.success(`Trajet créé - ID: ${tripId}`);
    log.debug('Trip Driver ID', createTrip.data.trip.driver);

    // 4. Réservation par Marie
    log.info('Création d\'une réservation par Marie...');
    const bookingData = {
      tripId: tripId,
      numberOfSeats: 1,
      message: 'Test de réservation'
    };

    const createBooking = await axios.post(`${BASE_URL}/bookings`, bookingData, {
      headers: { Authorization: `Bearer ${marieToken}` }
    });
    
    bookingId = createBooking.data.booking._id;
    log.success(`Réservation créée - ID: ${bookingId}`);
    log.debug('Booking details', {
      id: bookingId,
      tripId: createBooking.data.booking.trip,
      passengerId: createBooking.data.booking.passenger
    });

    // 5. Vérifier les détails avant confirmation
    log.info('Vérification des détails de la réservation...');
    const bookingDetails = await axios.get(`${BASE_URL}/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    
    log.debug('Booking details complets', {
      bookingId: bookingDetails.data.booking._id,
      tripDriver: bookingDetails.data.booking.trip?.driver,
      currentUserId: aliceId
    });

    // 6. Vérifier le profil d'Alice
    log.info('Vérification du profil d\'Alice...');
    const aliceProfile = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    log.debug('Alice profile', {
      id: aliceProfile.data.user.id,
      displayName: aliceProfile.data.user.profile.displayName
    });

    // 7. Tentative de confirmation
    log.info('Tentative de confirmation par Alice...');
    try {
      const confirmBooking = await axios.put(`${BASE_URL}/bookings/${bookingId}/confirm`, {}, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      log.success('Réservation confirmée avec succès !');
    } catch (error) {
      log.error('Erreur lors de la confirmation:');
      console.error('Status:', error.response?.status);
      console.error('Message:', error.response?.data?.message);
      console.error('Details:', error.response?.data);
      
      // Test avec re-authentification
      log.info('Test avec re-authentification d\'Alice...');
      const relogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: aliceEmail,
        password: 'Password123'
      });
      
      const newToken = relogin.data.token;
      log.debug('Nouveau token Alice', newToken.substring(0, 20) + '...');
      
      try {
        const retryConfirm = await axios.put(`${BASE_URL}/bookings/${bookingId}/confirm`, {}, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        log.success('Confirmation réussie avec nouveau token !');
      } catch (retryError) {
        log.error('Échec même avec nouveau token');
        console.error('Retry error:', retryError.response?.data);
      }
    }

  } catch (error) {
    console.error('\n❌ ERREUR GÉNÉRALE:');
    console.error('URL:', error.config?.url);
    console.error('Method:', error.config?.method);
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Full error:', error.response?.data);
  }
}

// Lancer le test de debug
runDebugTests();