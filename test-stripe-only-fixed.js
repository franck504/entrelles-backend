const axios = require('axios');
const readline = require('readline');

// const BASE_URL = 'http://localhost:3000/api'; 
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

async function testStripePaymentOnly() {
  console.log('💳 === TEST PAIEMENT STRIPE UNIQUEMENT ===\n');
  
  let token, userId, sessionId, customerId;
  
  try {
    // ========================================
    // 1. INSCRIPTION UTILISATEUR (CORRIGÉE)
    // ========================================
    console.log('👤 1. Création utilisateur de test...');
    const timestamp = Date.now();
    
    // ✅ DONNÉES COMPLÈTES selon les validations
    const registerData = {
      email: `stripe-only-${timestamp}@entrelles-test.com`,
      password: 'StripeTest123!', // ✅ Majuscule + minuscule + chiffre
      displayName: `Stripe Test User`, // ✅ Entre 2-50 caractères
      firstName: 'Marie', // ✅ Optionnel mais valide
      lastName: 'Stripe', // ✅ Optionnel mais valide
      gender: 'femme', // ✅ Requis et valide
      phone: '+33123456789' // ✅ Format valide
    };
    
    console.log('📋 Données d\'inscription:', {
      email: registerData.email,
      displayName: registerData.displayName,
      gender: registerData.gender,
      passwordLength: registerData.password.length
    });
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    token = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    console.log('✅ Utilisateur créé:', {
      id: userId,
      email: registerData.email,
      displayName: registerResponse.data.user.profile?.displayName
    });
    
    const headers = { Authorization: `Bearer ${token}` };

    // ========================================
    // 2. STATUT ABONNEMENT INITIAL
    // ========================================
    console.log('\n💰 2. Vérification statut initial...');
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
    
    sessionId = checkoutResponse.data.data.sessionId;
    const checkoutUrl = checkoutResponse.data.data.checkoutUrl;
    customerId = checkoutResponse.data.data.customerId;
    
    console.log('✅ Session Stripe créée:', {
      sessionId: sessionId.substring(0, 20) + '...',
      customerId: customerId.substring(0, 20) + '...',
      hasUrl: !!checkoutUrl
    });

    // ========================================
    // 4. AFFICHER URL DE PAIEMENT
    // ========================================
    console.log('\n🔗 === URL DE PAIEMENT STRIPE ===');
    console.log('📋 Copiez cette URL dans votre navigateur:');
    console.log(`\n${checkoutUrl}\n`);
    
    console.log('💳 === INFORMATIONS DE CARTE DE TEST ===');
    console.log('Numéro de carte: 4242 4242 4242 4242');
    console.log('Date d\'expiration: 12/34');
    console.log('CVC: 123');
    console.log('Code postal: 12345');
    console.log('Nom: Test User');

    // ========================================
    // 5. ATTENDRE PAIEMENT
    // ========================================
    console.log('\n⏳ Veuillez compléter le paiement dans votre navigateur...');
    await askQuestion('Appuyez sur Entrée après avoir complété le paiement...');

    // ========================================
    // 6. VÉRIFIER AVEC NOTRE ENDPOINT
    // ========================================
    console.log('\n🔄 6. Vérification avec notre endpoint verify-checkout...');
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`⏳ Tentative ${attempt}/3...`);
        
        const verifyResponse = await axios.get(`${BASE_URL}/payments/verify-checkout?sessionId=${sessionId}`);
        
        console.log('✅ Vérification réussie:', {
          success: verifyResponse.data.success,
          message: verifyResponse.data.message,
          paymentStatus: verifyResponse.data.data.paymentStatus,
          subscriptionStatus: verifyResponse.data.data.subscriptionStatus,
          email: verifyResponse.data.data.email
        });
        
        break; // Succès, sortir de la boucle
        
      } catch (verifyError) {
        console.log(`❌ Tentative ${attempt} échouée:`, {
          status: verifyError.response?.status,
          message: verifyError.response?.data?.message || verifyError.message
        });
        
        if (attempt < 3) {
          console.log('🔄 Nouvelle tentative dans 5 secondes...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.log('⚠️ Toutes les tentatives ont échoué. Le paiement n\'est peut-être pas encore traité.');
        }
      }
    }

    // ========================================
    // 7. VÉRIFIER STATUT FINAL
    // ========================================
    console.log('\n📊 7. Vérification statut final...');
    const finalStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut final:', {
      hasActiveSubscription: finalStatus.data.data.hasActiveSubscription,
      plan: finalStatus.data.data.plan,
      status: finalStatus.data.data.status,
      hasStripeCustomerId: !!finalStatus.data.data.stripeCustomerId
    });

    // ========================================
    // 8. PROFIL UTILISATEUR
    // ========================================
    console.log('\n👤 8. Profil utilisateur final...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    
    console.log('✅ Subscription dans profil:', {
      isActive: profileResponse.data.user.subscription?.isActive,
      plan: profileResponse.data.user.subscription?.plan,
      status: profileResponse.data.user.subscription?.status
    });

    // ========================================
    // 9. RÉSUMÉ
    // ========================================
    console.log('\n📊 === RÉSUMÉ DU TEST STRIPE ===');
    console.log(`✅ Utilisateur: ${registerData.email}`);
    console.log(`✅ Customer Stripe: ${customerId.substring(0, 20)}...`);
    console.log(`✅ Session: ${sessionId.substring(0, 20)}...`);
    console.log('✅ Endpoint verify-checkout testé');
    console.log('✅ Flux de paiement Stripe complet');
    
    console.log('\n🔍 === VÉRIFICATIONS STRIPE DASHBOARD ===');
    console.log('1. Paiements: https://dashboard.stripe.com/test/payments');
    console.log('2. Clients: https://dashboard.stripe.com/test/customers');
    console.log('3. Sessions: https://dashboard.stripe.com/test/checkout/sessions');

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE TEST:');
    
    if (error.response?.status === 400 && error.response?.data?.errors) {
      console.log('🔍 Erreurs de validation détaillées:');
      error.response.data.errors.forEach((err, index) => {
        console.log(`${index + 1}. Champ: ${err.field || 'inconnu'}`);
        console.log(`   Message: ${err.message || err.msg || 'erreur inconnue'}`);
        console.log(`   Valeur: ${err.value || 'non fournie'}`);
      });
    } else {
      console.log({
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  } finally {
    rl.close();
  }
}

// ========================================
// TEST SETUP UNIQUEMENT
// ========================================
async function testStripeSetupOnly() {
  console.log('\n🤖 === TEST SETUP STRIPE UNIQUEMENT ===');
  
  try {
    const timestamp = Date.now();
    
    // ✅ DONNÉES COMPLÈTES
    const registerData = {
      email: `setup-test-${timestamp}@entrelles-test.com`,
      password: 'SetupTest123!', // ✅ Conforme aux règles
      displayName: 'Setup Test User',
      firstName: 'Marie',
      lastName: 'Setup',
      gender: 'femme',
      phone: '+33987654321'
    };
    
    console.log('👤 Création utilisateur setup...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    
    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('✅ Utilisateur créé:', registerResponse.data.user.profile.displayName);
    
    // Statut initial
    const statusResponse = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    console.log('✅ Statut initial récupéré:', {
      hasActiveSubscription: statusResponse.data.data.hasActiveSubscription,
      plan: statusResponse.data.data.plan
    });
    
    // Créer checkout
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    console.log('✅ Session checkout créée:', {
      sessionId: checkoutResponse.data.data.sessionId.substring(0, 20) + '...',
      hasUrl: !!checkoutResponse.data.data.checkoutUrl
    });
    
    // Test verify avec session non payée
    try {
      await axios.get(`${BASE_URL}/payments/verify-checkout?sessionId=${checkoutResponse.data.data.sessionId}`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Verify-checkout fonctionne (session non payée - normal)');
      } else {
        console.log('⚠️ Erreur verify-checkout:', error.response?.data?.message);
      }
    }
    
    console.log('🎉 Setup Stripe fonctionnel !');
    
  } catch (error) {
    console.error('❌ Erreur setup:');
    
    if (error.response?.status === 400 && error.response?.data?.errors) {
      console.log('🔍 Erreurs de validation:');
      error.response.data.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.field}: ${err.message}`);
      });
    } else {
      console.log(error.response?.data || error.message);
    }
  }
}

// ========================================
// MENU
// ========================================
async function main() {
  console.log('🎯 === TESTS STRIPE ENTRELLES (CORRIGÉ) ===\n');
  console.log('1. Test complet avec paiement réel');
  console.log('2. Test setup uniquement (sans paiement)');
  console.log('3. Les deux tests\n');
  
  const choice = await askQuestion('Choisissez une option (1, 2, ou 3): ');
  
  switch(choice) {
    case '1':
      await testStripePaymentOnly();
      break;
    case '2':
      await testStripeSetupOnly();
      rl.close();
      break;
    case '3':
      await testStripeSetupOnly();
      console.log('\n' + '='.repeat(60));
      await testStripePaymentOnly();
      break;
    default:
      console.log('Option invalide');
      rl.close();
  }
}

// Lancer le test
main();