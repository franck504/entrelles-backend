const axios = require('axios');

// const BASE_URL = 'http://localhost:3000/api'; 
const BASE_URL = 'https://entrelles-backend.vercel.app/api';

async function testWithSimulation() {
  try {
    // 1. Inscription
    console.log('🔐 Inscription...');
    const register = await axios.post(`${BASE_URL}/auth/register`, {
      email: `sim-test-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Simulation Test User',
      firstName: 'Test',
      lastName: 'User',
      gender: 'femme'
    });
    
    const token = register.data.token;
    const userId = register.data.user.id;
    console.log('✅ Utilisateur créé:', userId);

    // 2. Statut AVANT paiement
    console.log('\n📊 Statut AVANT paiement...');
    const statusBefore = await axios.get(`${BASE_URL}/payments/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('📋 Avant:', statusBefore.data.data);

    // 3. Simuler le paiement
    console.log('\n🎭 Simulation du paiement...');
    const simulation = await axios.post(`${BASE_URL}/webhooks/simulate-payment`, {
      userId: userId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Paiement simulé:', simulation.data.message);

    // 4. Statut APRÈS paiement
    console.log('\n📊 Statut APRÈS paiement...');
    const statusAfter = await axios.get(`${BASE_URL}/payments/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('📋 Après:', statusAfter.data.data);

    // 5. Profil utilisateur mis à jour
    console.log('\n👤 Profil utilisateur...');
    const profile = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('📋 Subscription:', profile.data.user.subscription);

    console.log('\n🎉 Test terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testWithSimulation();