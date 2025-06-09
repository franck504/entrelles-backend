const axios = require('axios');

// const BASE_URL = 'http://localhost:3000/api'; 
const BASE_URL = 'https://entrelles-backend.vercel.app/api';
let authToken = '';

async function testStripeIntegration() {
  try {
    // 1. Inscription
    console.log('🔐 Test inscription...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: `test-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Test Stripe User',
      gender: 'femme'
    });
    
    authToken = registerResponse.data.token;
    console.log('✅ Inscription réussie');

    // 2. Créer session checkout
    console.log('💳 Test création checkout...');
    const checkoutResponse = await axios.post(
      `${BASE_URL}/payments/create-checkout`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Checkout créé:', checkoutResponse.data.data.checkoutUrl);

    // 3. Vérifier statut abonnement
    console.log('📊 Test statut abonnement...');
    const statusResponse = await axios.get(
      `${BASE_URL}/payments/subscription-status`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Statut:', statusResponse.data.data);

    // 4. Créer portail client
    console.log('🏪 Test portail client...');
    const portalResponse = await axios.post(
      `${BASE_URL}/payments/create-portal`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Portail créé:', portalResponse.data.data.portalUrl);

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testStripeIntegration();