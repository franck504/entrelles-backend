const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function debugBooking() {
  try {
    console.log('🔍 Test de debug pour les réservations');

    // 1. Inscription rapide
    const alice = await axios.post(`${BASE_URL}/auth/register`, {
      email: `alice${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Alice Test',
      gender: 'femme'
    });

    const marie = await axios.post(`${BASE_URL}/auth/register`, {
      email: `marie${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Marie Test',
      gender: 'femme'
    });

    console.log('✅ Utilisateurs créés');

    // 2. Créer un trajet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trip = await axios.post(`${BASE_URL}/trips`, {
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
      description: 'Test debug'
    }, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    console.log('✅ Trajet créé:', trip.data.trip._id);

    // 3. Créer une réservation
    const booking = await axios.post(`${BASE_URL}/bookings`, {
      tripId: trip.data.trip._id,
      numberOfSeats: 1,
      message: 'Test debug booking'
    }, {
      headers: { Authorization: `Bearer ${marie.data.token}` }
    });

    const bookingId = booking.data.booking._id;
    console.log('✅ Réservation créée:', bookingId);

    // 4. Vérifier que la réservation existe
    console.log('🔍 Vérification de l\'existence de la réservation...');
    const checkBooking = await axios.get(`${BASE_URL}/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });
    console.log('✅ Réservation trouvée:', checkBooking.data.booking.status);

    // 5. Tenter la confirmation
    console.log('🔍 Tentative de confirmation...');
    console.log('URL:', `${BASE_URL}/bookings/${bookingId}/confirm`);
    
    const confirm = await axios.put(`${BASE_URL}/bookings/${bookingId}/confirm`, {}, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });
    
    console.log('✅ Confirmation réussie !');
    console.log('Status:', confirm.data.booking.status);

  } catch (error) {
    console.error('❌ Erreur debug:');
    console.error('URL:', error.config?.url);
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Data:', error.response?.data);
  }
}

debugBooking();