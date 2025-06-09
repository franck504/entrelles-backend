const axios = require('axios');
const readline = require('readline');

// Configuration
const BASE_URL = 'https://entrelles-backend.vercel.app/api';

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
    // 6. VÉRIFIER STATUT APRÈS PAIEMENT (PLUSIEURS TENTATIVES)
    // ========================================
    console.log('\n🔄 6. Vérification du statut après paiement...');
    
    let updatedStatus;
    let webhookReceived = false;
    const maxAttempts = 6; // 6 tentatives sur 30 secondes
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`⏳ Tentative ${attempt}/${maxAttempts} - Attente webhook (5 secondes)...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      updatedStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
      
      if (updatedStatus.data.data.hasActiveSubscription) {
        webhookReceived = true;
        console.log('🎉 WEBHOOK REÇU ! Abonnement activé automatiquement');
        break;
      } else {
        console.log(`❌ Tentative ${attempt} - Webhook non reçu encore...`);
      }
    }
    
    console.log('\n✅ Statut final après paiement:', {
      hasActiveSubscription: updatedStatus.data.data.hasActiveSubscription,
      plan: updatedStatus.data.data.plan,
      status: updatedStatus.data.data.status,
      currentPeriodEnd: updatedStatus.data.data.currentPeriodEnd,
      stripeCustomerId: updatedStatus.data.data.stripeCustomerId,
      webhookReceived: webhookReceived
    });

    // ========================================
    // 7. DIAGNOSTIC SI WEBHOOK NON REÇU
    // ========================================
    if (!webhookReceived) {
      console.log('\n🚨 === DIAGNOSTIC WEBHOOK ===');
      console.log('❌ Aucun webhook reçu après 30 secondes');
      console.log('🔧 ACTIONS REQUISES :');
      console.log('1. Vérifiez la configuration webhook dans Stripe Dashboard');
      console.log('2. URL webhook : https://entrelles-backend.vercel.app/api/webhooks/stripe');
      console.log('3. Événements requis : checkout.session.completed, customer.subscription.*');
      console.log('4. Vérifiez que STRIPE_WEBHOOK_SECRET est configuré dans Vercel');
      console.log('\n🔍 VÉRIFICATIONS :');
      console.log('- Dashboard Stripe : https://dashboard.stripe.com/test/webhooks');
      console.log('- Logs Vercel : https://vercel.com/dashboard');
      console.log('- Test webhook : https://dashboard.stripe.com/test/webhooks/[webhook_id]');
      
      // NE PAS faire de simulation pour un vrai test
      console.log('\n⚠️ Test interrompu - Webhooks requis pour un test réel');
      return;
    }

    // ========================================
    // 8. VÉRIFIER PROFIL UTILISATEUR
    // ========================================
    console.log('\n👤 8. Vérification profil utilisateur...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    
    console.log('✅ Profil utilisateur:', {
      email: profileResponse.data.user.email,
      subscription: profileResponse.data.user.subscription
    });

    // ========================================
    // 9. TESTER PORTAIL CLIENT
    // ========================================
    console.log('\n🏪 9. Test portail client Stripe...');
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
    // 10. RÉSUMÉ FINAL
    // ========================================
    console.log('\n📊 === RÉSUMÉ DU TEST RÉEL ===');
    console.log(`✅ Utilisateur créé: ${registerData.email}`);
    console.log(`✅ Customer Stripe: ${customerId}`);
    console.log(`✅ Session checkout: ${sessionId}`);
    console.log('✅ Paiement traité par Stripe');
    console.log('✅ Webhook reçu et traité automatiquement');
    console.log('✅ Abonnement activé sans simulation');
    console.log('\n🎉 TEST RÉEL RÉUSSI ! Intégration Stripe fonctionnelle');
    
    // Informations pour vérification
    console.log('\n🔍 === VÉRIFICATIONS DASHBOARD STRIPE ===');
    console.log('1. Paiements : https://dashboard.stripe.com/test/payments');
    console.log('2. Abonnements : https://dashboard.stripe.com/test/subscriptions');
    console.log('3. Clients : https://dashboard.stripe.com/test/customers');
    console.log('4. Webhooks : https://dashboard.stripe.com/test/webhooks');

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE TEST:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  } finally {
    rl.close();
  }
}

// ========================================
// TEST AUTOMATISÉ AVEC SIMULATION (SÉPARÉ)
// ========================================
async function testWithSimulation() {
  console.log('\n🤖 === TEST AUTOMATISÉ AVEC SIMULATION ===');
  console.log('⚠️ Ce test utilise une simulation, pas de vrais webhooks Stripe');
  
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
  console.log('1. Test avec VRAI paiement Stripe + webhooks réels');
  console.log('2. Test avec simulation automatique (développement)');
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