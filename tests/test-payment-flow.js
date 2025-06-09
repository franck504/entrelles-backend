const axios = require('axios');

// const BASE_URL = 'http://localhost:3000/api'; 
const BASE_URL = 'https://entrelles-backend.vercel.app/api';

async function testCompletePaymentFlow() {
  try {
    console.log('🔐 Inscription...');
    const register = await axios.post(`${BASE_URL}/auth/register`, {
      email: `premium-test-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Premium Firanky',
      gender: 'femme'
    });
    
    const token = register.data.token;
    console.log('✅ Utilisateur créé');

    console.log('💳 Création checkout...');
    const checkout = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('🔗 URL de paiement:', checkout.data.data.checkoutUrl);
    console.log('📋 Instructions:');
    console.log('1. Ouvrez cette URL dans votre navigateur');
    console.log('2. Utilisez une carte de test: 4242 4242 4242 4242');
    console.log('3. Date: 12/34, CVC: 123');
    console.log('4. Complétez le paiement');
    console.log('5. Revenez ici pour vérifier le statut');

    // Attendre que l'utilisateur teste le paiement
    console.log('\n⏳ Appuyez sur Entrée après avoir testé le paiement...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    console.log('📊 Vérification du statut après paiement...');
    const status = await axios.get(`${BASE_URL}/payments/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Nouveau statut:', status.data.data);

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testCompletePaymentFlow();