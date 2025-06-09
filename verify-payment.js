const axios = require('axios');

// const BASE_URL = 'http://localhost:3000/api'; 
const BASE_URL = 'https://entrelles-backend.vercel.app/api';

async function verifyPayment() {
  try {
    // Inscription
    console.log('🔐 Inscription...');
    const register = await axios.post(`${BASE_URL}/auth/register`, {
      email: `verify-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Verify User',
      gender: 'femme'
    });
    
    const token = register.data.token;
    const userId = register.data.user.id;
    console.log('✅ Utilisateur créé:', userId);

    // Créer checkout
    console.log('💳 Création checkout...');
    const checkout = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const sessionId = checkout.data.data.sessionId;
    console.log('✅ Session ID:', sessionId);
    console.log('🔗 URL:', checkout.data.data.checkoutUrl);

    // Simuler un paiement réussi (webhook manuel)
    console.log('\n🔄 Simulation du webhook...');
    
    // Récupérer l'utilisateur pour voir son stripeCustomerId
    const userProfile = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('👤 Profil utilisateur:', {
      id: userProfile.data.user.id,
      email: userProfile.data.user.email,
      subscription: userProfile.data.user.subscription || 'Non défini'
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

verifyPayment();