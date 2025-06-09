const axios = require('axios');

async function testMinimalReview() {
  try {
    const BASE_URL = 'http://localhost:3000/api';
    
    // Créer utilisateurs
    const alice = await axios.post(`${BASE_URL}/auth/register`, {
      email: `alice${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Alice',
      gender: 'femme'
    });

    const marie = await axios.post(`${BASE_URL}/auth/register`, {
      email: `marie${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Marie',
      gender: 'femme'
    });

    // Créer trajet
    const trip = await axios.post(`${BASE_URL}/trips`, {
      departure: { city: 'Paris', address: 'Test', coordinates: { lat: 48.8566, lng: 2.3522 } },
      arrival: { city: 'Lyon', address: 'Test', coordinates: { lat: 45.7640, lng: 4.8357 } },
      departureDateTime: new Date(Date.now() + 24*60*60*1000).toISOString(),
      estimatedDuration: 300,
      availableSeats: 3,
      pricePerSeat: 25,
      distance: 400,
      description: 'Test'
    }, { headers: { Authorization: `Bearer ${alice.data.token}` } });

    // Créer et traiter réservation
    const booking = await axios.post(`${BASE_URL}/bookings`, {
      tripId: trip.data.trip._id,
      numberOfSeats: 1,
      message: 'Test'
    }, { headers: { Authorization: `Bearer ${marie.data.token}` } });

    await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/confirm`, {}, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/complete`, {}, {
      headers: { Authorization: `Bearer ${alice.data.token}` }
    });

    // TEST REVIEW
    console.log('🔍 Testing review...');
    const review = await axios.put(`${BASE_URL}/bookings/${booking.data.booking._id}/review`, {
      rating: 5,
      comment: 'Test review'
    }, { headers: { Authorization: `Bearer ${marie.data.token}` } });

    console.log('✅ SUCCESS! Review added');
    console.log('Review data:', review.data.booking.review);

  } catch (error) {
    console.error('❌ ERROR:', error.response?.data?.message || error.message);
  }
}

testMinimalReview();