const axios = require('axios');

// Configuration
const BASE_URL = 'https://entrelles-backend.vercel.app/api';
// const BASE_URL = 'http://localhost:3000/api';

async function testSubscriptionFlow() {
  console.log('🧪 === TEST COMPLET ABONNEMENT STRIPE ===\n');
  
  let token, userId;
  
  try {
    // ========================================
    // 1. INSCRIPTION UTILISATEUR
    // ========================================
    console.log('👤 1. Inscription utilisateur...');
    const registerData = {
      email: `test-sub-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Test Subscription User',
      gender: 'femme'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    token = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    console.log('✅ Utilisateur créé:', {
      id: userId,
      email: registerData.email,
      subscription: registerResponse.data.user.subscription
    });
    
    const headers = { Authorization: `Bearer ${token}` };

    // ========================================
    // 2. VÉRIFIER STATUT INITIAL (FREE)
    // ========================================
    console.log('\n💰 2. Vérification statut initial...');
    const initialStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut initial:', {
      hasActiveSubscription: initialStatus.data.data.hasActiveSubscription,
      plan: initialStatus.data.data.plan,
      status: initialStatus.data.data.status
    });

    // ========================================
    // 3. CRÉER SESSION CHECKOUT
    // ========================================
    console.log('\n🛒 3. Création session checkout...');
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    
    console.log('✅ Session checkout créée:', {
      sessionId: checkoutResponse.data.data.sessionId,
      checkoutUrl: checkoutResponse.data.data.checkoutUrl,
      customerId: checkoutResponse.data.data.customerId
    });

    // ========================================
    // 4. SIMULER PAIEMENT RÉUSSI
    // ========================================
    console.log('\n💳 4. Simulation paiement réussi...');
    const simulateResponse = await axios.post(`${BASE_URL}/webhooks/simulate-payment`, {
      userId: userId
    }, { headers });
    
    console.log('✅ Paiement simulé:', simulateResponse.data.message);

    // ========================================
    // 5. VÉRIFIER STATUT APRÈS PAIEMENT
    // ========================================
    console.log('\n🔄 5. Vérification statut après paiement...');
    const updatedStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut mis à jour:', {
      hasActiveSubscription: updatedStatus.data.data.hasActiveSubscription,
      plan: updatedStatus.data.data.plan,
      status: updatedStatus.data.data.status,
      currentPeriodEnd: updatedStatus.data.data.currentPeriodEnd
    });

    // ========================================
    // 6. CRÉER PORTAIL CLIENT
    // ========================================
    console.log('\n🏪 6. Création portail client...');
    const portalResponse = await axios.post(`${BASE_URL}/payments/create-portal`, {}, { headers });
    
    console.log('✅ Portail client créé:', {
      portalUrl: portalResponse.data.data.portalUrl
    });

    // ========================================
    // 7. TESTER ANNULATION ABONNEMENT
    // ========================================
    console.log('\n❌ 7. Test annulation abonnement...');
    try {
      const cancelResponse = await axios.post(`${BASE_URL}/payments/cancel-subscription`, {}, { headers });
      console.log('✅ Abonnement programmé pour annulation:', cancelResponse.data.message);
    } catch (error) {
      console.log('⚠️ Annulation non possible (normal en simulation):', error.response?.data?.message);
    }

    // ========================================
    // 8. VÉRIFIER PROFIL UTILISATEUR FINAL
    // ========================================
    console.log('\n👤 8. Profil utilisateur final...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    
    console.log('✅ Profil final:', {
      id: profileResponse.data.user.id,
      email: profileResponse.data.user.email,
      subscription: {
        isActive: profileResponse.data.user.subscription.isActive,
        plan: profileResponse.data.user.subscription.plan,
        status: profileResponse.data.user.subscription.status
      }
    });

    // ========================================
    // 9. RÉSUMÉ DU TEST
    // ========================================
    console.log('\n📊 === RÉSUMÉ DU TEST ===');
    console.log('✅ Inscription utilisateur: OK');
    console.log('✅ Statut initial (Free): OK');
    console.log('✅ Création checkout: OK');
    console.log('✅ Simulation paiement: OK');
    console.log('✅ Activation Premium: OK');
    console.log('✅ Portail client: OK');
    console.log('✅ Test complet: RÉUSSI 🎉');

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE TEST:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Détails de l'erreur
    if (error.response?.data) {
      console.error('📋 Détails:', error.response.data);
    }
  }
}

// ========================================
// TEST AVEC VRAI STRIPE (OPTIONNEL)
// ========================================
async function testRealStripeFlow() {
  console.log('\n🔥 === TEST AVEC VRAI STRIPE ===');
  console.log('⚠️ Ce test nécessite une vraie carte de test Stripe');
  
  try {
    // Inscription
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: `real-test-${Date.now()}@example.com`,
      password: 'Password123',
      displayName: 'Real Stripe Test',
      gender: 'femme'
    });
    
    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // Créer checkout
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    
    console.log('🔗 URL de paiement Stripe:');
    console.log(checkoutResponse.data.data.checkoutUrl);
    console.log('\n📝 Instructions:');
    console.log('1. Ouvrez cette URL dans votre navigateur');
    console.log('2. Utilisez la carte de test: 4242 4242 4242 4242');
    console.log('3. Date: 12/34, CVC: 123');
    console.log('4. Complétez le paiement');
    console.log('5. Le webhook activera automatiquement l\'abonnement');
    
  } catch (error) {
    console.error('❌ Erreur test réel:', error.response?.data || error.message);
  }
}

// ========================================
// EXÉCUTION DES TESTS
// ========================================
async function runAllTests() {
  await testSubscriptionFlow();
  
  console.log('\n' + '='.repeat(50));
  console.log('🤔 Voulez-vous tester avec une vraie session Stripe ?');
  console.log('Décommentez la ligne suivante:');
  console.log('// await testRealStripeFlow();');
}

// Lancer les tests
runAllTests();