const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testReview() {
  try {
    console.log('🔍 Test spécifique pour les reviews');

    // 1. Créer utilisateurs
    const alice = await axios.post(`${BASE_URL}/auth/register`, {
      email: `alice${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Alice Review',
      gender: 'femme'
    });

    const marie = await axios.post(`${BASE_URL}/auth/register`, {
      email: `marie${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Marie Review',
      gender: 'femme'
    });

    console.log('✅ Utilisateurs créés');

    // 2. Créer trajet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trip = await axios.post(`${BASE_URL}/trips`, {
      departure: {
        city: 'Paris',
        address: 'Test',
        coordinates: { lat: 48.8566, lng: 2.3522 }
      },
      arrival: {
        city: 'Lyon',
        address: 'Test',
        coordinates: { lat: 45.7640, lng: 4.8357 }
      },
      departureDateTime: tomorrow.toISOString(),
      estimatedDuration: 300,
      availableSeats: 3,
      pricePerSeat: 25,
      distance: 400,
      description: 'Test review'
    }, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    console.log('✅ Trajet créé');

    // 3. Créer réservation
    const booking = await axios.post(`${BASE_URL}/bookings`, {
      tripId: trip.data.trip._id,
      numberOfSeats: 1,
      message: 'Test review booking'
    }, {
      headers: { Authorization: `Bearer ${marie.data.token}` }
    });

    console.log('✅ Réservation créée');

    // 4. Confirmer
    await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/confirm`, {}, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    console.log('✅ Réservation confirmée');

    // 5. Compléter
    await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/complete`, {}, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    console.log('✅ Trajet terminé');

    // 6. Ajouter review
    const review = await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/review`, {
      rating: 5,
      comment: 'Excellent trajet test !'
    }, {
      headers: { Authorization: `Bearer ${marie.data.token}` }
    });

    console.log('✅ Review ajoutée avec succès !');
    console.log('📊 Review:', review.data.booking.review);

    // 7. Vérifier le profil d'Alice
    const aliceProfile = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    console.log('📊 Stats Alice après review:', aliceProfile.data.user.stats);

  } catch (error) {
    console.error('❌ Erreur test review:');
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Details:', error.response?.data);
  }
}

testReview();