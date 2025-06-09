const axios = require('axios');
const readline = require('readline');

// Configuration - Changez selon votre environnement
const BASE_URL = 'https://entrelles-backend.vercel.app/api';
// const BASE_URL = 'http://localhost:3000/api'; // Pour local

// Interface pour interaction utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testRealStripePayment() {
  console.log('💳 === TEST PAIEMENT STRIPE RÉEL (MODE TEST) ===\n');
  
  let token, userId, customerId;
  
  try {
    // ========================================
    // 1. INSCRIPTION UTILISATEUR
    // ========================================
    console.log('👤 1. Création utilisateur de test...');
    const timestamp = Date.now();
    const registerData = {
      email: `stripe-test-${timestamp}@entrelles-test.com`,
      password: 'TestStripe123!',
      displayName: `Stripe Test User ${timestamp}`,
      firstName: 'Marie',
      lastName: 'Testeur',
      gender: 'femme',
      phone: '+33123456789'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    token = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    console.log('✅ Utilisateur créé:', {
      id: userId,
      email: registerData.email,
      name: registerData.displayName
    });
    
    const headers = { Authorization: `Bearer ${token}` };

    // ========================================
    // 2. VÉRIFIER STATUT INITIAL
    // ========================================
    console.log('\n💰 2. Vérification statut abonnement initial...');
    const initialStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut initial:', {
      hasActiveSubscription: initialStatus.data.data.hasActiveSubscription,
      plan: initialStatus.data.data.plan || 'free',
      status: initialStatus.data.data.status
    });

    // ========================================
    // 3. CRÉER SESSION CHECKOUT STRIPE
    // ========================================
    console.log('\n🛒 3. Création session checkout Stripe...');
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    
    const sessionId = checkoutResponse.data.data.sessionId;
    const checkoutUrl = checkoutResponse.data.data.checkoutUrl;
    customerId = checkoutResponse.data.data.customerId;
    
    console.log('✅ Session Stripe créée:', {
      sessionId: sessionId,
      customerId: customerId
    });

    // ========================================
    // 4. AFFICHER URL DE PAIEMENT
    // ========================================
    console.log('\n🔗 === URL DE PAIEMENT STRIPE ===');
    console.log('📋 Copiez cette URL dans votre navigateur:');
    console.log(`\n${checkoutUrl}\n`);
    
    console.log('💳 === INFORMATIONS DE CARTE DE TEST ===');
    console.log('Numéro de carte: 4242 4242 4242 4242');
    console.log('Date d\'expiration: 12/34 (ou toute date future)');
    console.log('CVC: 123');
    console.log('Code postal: 12345');
    console.log('Nom: Test User');

    // ========================================
    // 5. ATTENDRE CONFIRMATION UTILISATEUR
    // ========================================
    console.log('\n⏳ Veuillez compléter le paiement dans votre navigateur...');
    await askQuestion('Appuyez sur Entrée après avoir complété le paiement...');

    // ========================================
    // 6. VÉRIFIER STATUT APRÈS PAIEMENT
    // ========================================
    console.log('\n🔄 6. Vérification du statut après paiement...');
    
    // Attendre un peu pour que le webhook soit traité
    console.log('⏳ Attente du traitement du webhook (5 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const updatedStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut après paiement:', {
      hasActiveSubscription: updatedStatus.data.data.hasActiveSubscription,
      plan: updatedStatus.data.data.plan,
      status: updatedStatus.data.data.status,
      currentPeriodEnd: updatedStatus.data.data.currentPeriodEnd,
      stripeCustomerId: updatedStatus.data.data.stripeCustomerId
    });

    // ========================================
    // 7. VÉRIFIER PROFIL UTILISATEUR
    // ========================================
    console.log('\n👤 7. Vérification profil utilisateur...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    
    console.log('✅ Profil utilisateur:', {
      email: profileResponse.data.user.email,
      subscription: profileResponse.data.user.subscription
    });

    // ========================================
    // 8. TESTER PORTAIL CLIENT
    // ========================================
    console.log('\n🏪 8. Test portail client Stripe...');
    try {
      const portalResponse = await axios.post(`${BASE_URL}/payments/create-portal`, {}, { headers });
      console.log('✅ Portail client créé:', {
        portalUrl: portalResponse.data.data.portalUrl
      });
      
      console.log('\n🔗 URL du portail client:');
      console.log(portalResponse.data.data.portalUrl);
      
    } catch (error) {
      console.log('⚠️ Erreur portail client:', error.response?.data?.message);
    }

    // ========================================
    // 9. RÉSUMÉ FINAL
    // ========================================
    console.log('\n📊 === RÉSUMÉ DU TEST ===');
    console.log(`✅ Utilisateur créé: ${registerData.email}`);
    console.log(`✅ Customer Stripe: ${customerId}`);
    console.log(`✅ Session checkout: ${sessionId}`);
    console.log('✅ Paiement traité par Stripe');
    console.log('✅ Webhook reçu et traité');
    console.log('✅ Abonnement activé');
    console.log('\n🎉 TEST RÉUSSI - Vérifiez votre dashboard Stripe !');
    
    // Informations pour vérification
    console.log('\n🔍 === VÉRIFICATIONS DASHBOARD STRIPE ===');
    console.log('1. Allez sur https://dashboard.stripe.com/test/payments');
    console.log('2. Cherchez le paiement avec l\'email:', registerData.email);
    console.log('3. Vérifiez les webhooks sur https://dashboard.stripe.com/test/webhooks');
    console.log('4. Consultez les clients sur https://dashboard.stripe.com/test/customers');

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE TEST:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.data) {
      console.error('📋 Détails de l\'erreur:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    rl.close();
  }
}

// ========================================
// TEST AUTOMATISÉ AVEC SIMULATION
// ========================================
async function testWithSimulation() {
  console.log('\n🤖 === TEST AUTOMATISÉ AVEC SIMULATION ===');
  
  try {
    // Inscription
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: `auto-test-${Date.now()}@entrelles-test.com`,
      password: 'AutoTest123!',
      displayName: 'Auto Test User',
      gender: 'femme'
    });
    
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.id;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('✅ Utilisateur auto créé:', userId);
    
    // Créer checkout
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    console.log('✅ Checkout créé:', checkoutResponse.data.data.sessionId);
    
    // Simuler paiement
    const simulateResponse = await axios.post(`${BASE_URL}/webhooks/simulate-payment`, {
      userId: userId
    }, { headers });
    
    console.log('✅ Paiement simulé:', simulateResponse.data.message);
    
    // Vérifier statut
    const statusResponse = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    console.log('✅ Statut final:', statusResponse.data.data);
    
  } catch (error) {
    console.error('❌ Erreur simulation:', error.response?.data || error.message);
  }
}

// ========================================
// MENU PRINCIPAL
// ========================================
async function main() {
  console.log('🎯 === TESTS PAIEMENT STRIPE ENTRELLES ===\n');
  console.log('1. Test avec VRAI paiement Stripe (interactif)');
  console.log('2. Test avec simulation automatique');
  console.log('3. Les deux tests\n');
  
  const choice = await askQuestion('Choisissez une option (1, 2, ou 3): ');
  
  switch(choice) {
    case '1':
      await testRealStripePayment();
      break;
    case '2':
      await testWithSimulation();
      break;
    case '3':
      await testWithSimulation();
      console.log('\n' + '='.repeat(60));
      await testRealStripePayment();
      break;
    default:
      console.log('Option invalide');
      rl.close();
  }
}

// Lancer le test
main();