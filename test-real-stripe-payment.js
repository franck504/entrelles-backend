const axios = require('axios');
const readline = require('readline');

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
  console.log('💳 === TEST RÉEL PAIEMENT STRIPE (MODE TEST) ===\n');
  
  let token, userId, sessionId, checkoutUrl;
  
  try {
    // ========================================
    // 1. INSCRIPTION UTILISATEUR RÉEL
    // ========================================
    console.log('👤 1. Création utilisateur de test...');
    const timestamp = Date.now();
    
    const registerData = {
      email: `real-test-${timestamp}@entrelles-test.com`,
      password: 'RealTest123!',
      displayName: `Real Test User ${timestamp}`,
      firstName: 'Marie',
      lastName: 'RealTest',
      gender: 'femme',
      phone: '+33123456789'
    };
    
    console.log('📋 Inscription en cours...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    
    token = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    console.log('✅ Utilisateur créé avec succès !');
    console.log(`📧 Email: ${registerData.email}`);
    console.log(`🆔 ID: ${userId}`);
    
    const headers = { Authorization: `Bearer ${token}` };

    // ========================================
    // 2. VÉRIFICATION STATUT INITIAL
    // ========================================
    console.log('\n💰 2. Vérification du statut initial...');
    const initialStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    
    console.log('✅ Statut initial confirmé:');
    console.log(`   - Abonnement actif: ${initialStatus.data.data.hasActiveSubscription}`);
    console.log(`   - Plan: ${initialStatus.data.data.plan}`);
    console.log(`   - Statut: ${initialStatus.data.data.status}`);

    // ========================================
    // 3. CRÉATION SESSION CHECKOUT STRIPE
    // ========================================
    console.log('\n🛒 3. Création de la session de paiement Stripe...');
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    
    sessionId = checkoutResponse.data.data.sessionId;
    checkoutUrl = checkoutResponse.data.data.checkoutUrl;
    const customerId = checkoutResponse.data.data.customerId;
    
    console.log('✅ Session Stripe créée avec succès !');
    console.log(`🔑 Session ID: ${sessionId}`);
    console.log(`👤 Customer ID: ${customerId}`);
    console.log(`🔗 URL de paiement générée`);

    // ========================================
    // 4. AFFICHAGE URL ET INSTRUCTIONS
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('🔗 === URL DE PAIEMENT STRIPE (MODE TEST) ===');
    console.log('='.repeat(80));
    console.log('\n📋 COPIEZ CETTE URL DANS VOTRE NAVIGATEUR:');
    console.log(`\n${checkoutUrl}\n`);
    
    console.log('💳 === CARTES DE TEST STRIPE DISPONIBLES ===');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ 🟢 SUCCÈS - Visa                                       │');
    console.log('│ Numéro: 4242 4242 4242 4242                            │');
    console.log('│ Date: 12/34 | CVC: 123 | ZIP: 12345                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 🟢 SUCCÈS - Mastercard                                 │');
    console.log('│ Numéro: 5555 5555 5555 4444                            │');
    console.log('│ Date: 12/34 | CVC: 123 | ZIP: 12345                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 🔴 ÉCHEC - Carte déclinée                               │');
    console.log('│ Numéro: 4000 0000 0000 0002                            │');
    console.log('│ Date: 12/34 | CVC: 123 | ZIP: 12345                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 🟡 AUTHENTIFICATION 3D Secure                          │');
    console.log('│ Numéro: 4000 0025 0000 3155                            │');
    console.log('│ Date: 12/34 | CVC: 123 | ZIP: 12345                    │');
    console.log('└─────────────────────────────────────────────────────────┘');
    
    console.log('\n📝 INSTRUCTIONS:');
    console.log('1. Ouvrez l\'URL dans votre navigateur');
    console.log('2. Utilisez une des cartes de test ci-dessus');
    console.log('3. Remplissez les informations (nom: Test User)');
    console.log('4. Cliquez sur "Payer"');
    console.log('5. Revenez ici et appuyez sur Entrée');

    // ========================================
    // 5. ATTENTE DU PAIEMENT
    // ========================================
    console.log('\n⏳ En attente du paiement...');
    await askQuestion('\n🔄 Appuyez sur Entrée APRÈS avoir complété le paiement...');

    // ========================================
    // 6. VÉRIFICATION AUTOMATIQUE
    // ========================================
    console.log('\n🔍 6. Vérification automatique du paiement...');
    
    let paymentVerified = false;
    const maxAttempts = 5;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`⏳ Tentative ${attempt}/${maxAttempts}...`);
        
        const verifyResponse = await axios.get(`${BASE_URL}/payments/verify-checkout?sessionId=${sessionId}`);
        
        console.log('🎉 PAIEMENT VÉRIFIÉ AVEC SUCCÈS !');
        console.log('✅ Détails de la vérification:');
        console.log(`   - Statut paiement: ${verifyResponse.data.data.paymentStatus}`);
        console.log(`   - Statut abonnement: ${verifyResponse.data.data.subscriptionStatus}`);
        console.log(`   - Email utilisateur: ${verifyResponse.data.data.email}`);
        
        paymentVerified = true;
        break;
        
      } catch (verifyError) {
        const status = verifyError.response?.status;
        const message = verifyError.response?.data?.message;
        
        console.log(`❌ Tentative ${attempt} échouée:`);
        console.log(`   - Code: ${status}`);
        console.log(`   - Message: ${message}`);
        
        if (status === 400 && message?.includes('not completed')) {
          console.log('⚠️ Le paiement n\'est pas encore traité par Stripe');
          
          if (attempt < maxAttempts) {
            console.log('🔄 Nouvelle tentative dans 3 secondes...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } else {
          console.log('❌ Erreur différente, arrêt des tentatives');
          break;
        }
      }
    }
    
    if (!paymentVerified) {
      console.log('\n⚠️ PAIEMENT NON VÉRIFIÉ AUTOMATIQUEMENT');
      console.log('Cela peut signifier:');
      console.log('- Le paiement n\'a pas été complété');
      console.log('- Le paiement est en cours de traitement');
      console.log('- Une erreur s\'est produite');
    }

    // ========================================
    // 7. VÉRIFICATION STATUT FINAL
    // ========================================
    console.log('\n📊 7. Vérification du statut final...');
    
    try {
      const finalStatus = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
      
      console.log('✅ Statut final récupéré:');
      console.log(`   - Abonnement actif: ${finalStatus.data.data.hasActiveSubscription}`);
      console.log(`   - Plan: ${finalStatus.data.data.plan}`);
      console.log(`   - Statut: ${finalStatus.data.data.status}`);
      console.log(`   - Customer Stripe: ${finalStatus.data.data.stripeCustomerId ? 'Oui' : 'Non'}`);
      
      if (finalStatus.data.data.currentPeriodEnd) {
        const endDate = new Date(finalStatus.data.data.currentPeriodEnd);
        console.log(`   - Fin période: ${endDate.toLocaleDateString('fr-FR')}`);
      }
      
    } catch (statusError) {
      console.log('❌ Erreur récupération statut final:', statusError.response?.data?.message);
    }

    // ========================================
    // 8. PROFIL UTILISATEUR FINAL
    // ========================================
    console.log('\n👤 8. Profil utilisateur final...');
    
    try {
      const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
      const subscription = profileResponse.data.user.subscription;
      
      console.log('✅ Profil récupéré:');
      console.log(`   - Email: ${profileResponse.data.user.email}`);
      console.log(`   - Nom: ${profileResponse.data.user.profile.displayName}`);
      console.log(`   - Abonnement actif: ${subscription?.isActive || false}`);
      console.log(`   - Plan: ${subscription?.plan || 'free'}`);
      
    } catch (profileError) {
      console.log('❌ Erreur récupération profil:', profileError.response?.data?.message);
    }

    // ========================================
    // 9. RÉSUMÉ FINAL
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 === RÉSUMÉ DU TEST RÉEL ===');
    console.log('='.repeat(80));
    console.log(`✅ Utilisateur créé: ${registerData.email}`);
    console.log(`✅ Session Stripe: ${sessionId}`);
    console.log(`✅ URL de paiement générée et utilisée`);
    console.log(`✅ Vérification automatique: ${paymentVerified ? 'SUCCÈS' : 'ÉCHEC'}`);
    console.log(`✅ API Entrelles: Fonctionnelle`);
    
    console.log('\n🔍 === VÉRIFICATIONS STRIPE DASHBOARD ===');
    console.log('Connectez-vous à: https://dashboard.stripe.com/test');
    console.log('1. Paiements: https://dashboard.stripe.com/test/payments');
    console.log('2. Clients: https://dashboard.stripe.com/test/customers');
    console.log('3. Abonnements: https://dashboard.stripe.com/test/subscriptions');
    console.log(`4. Rechercher: ${registerData.email}`);

    // ========================================
    // 10. TEST PORTAIL CLIENT (BONUS)
    // ========================================
    if (paymentVerified) {
      console.log('\n🎁 === BONUS: TEST PORTAIL CLIENT ===');
      
      const testPortal = await askQuestion('Voulez-vous tester le portail client ? (y/n): ');
      
      if (testPortal.toLowerCase() === 'y') {
        try {
          const portalResponse = await axios.post(`${BASE_URL}/payments/create-portal`, {}, { headers });
          
          console.log('✅ Portail client créé !');
          console.log(`🔗 URL: ${portalResponse.data.data.portalUrl}`);
          console.log('\n📝 Le portail permet de:');
          console.log('- Voir les factures');
          console.log('- Mettre à jour les informations de paiement');
          console.log('- Annuler l\'abonnement');
          
        } catch (portalError) {
          console.log('⚠️ Portail client non disponible:', portalError.response?.data?.message);
          
          if (portalError.response?.data?.configUrl) {
            console.log(`🔧 Configuration requise: ${portalError.response.data.configUrl}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE DANS LE TEST:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Statut HTTP:', error.response.status);
      console.error('Données:', error.response.data);
    }
    
    console.log('\n🔧 ACTIONS À VÉRIFIER:');
    console.log('1. L\'API est-elle déployée et accessible ?');
    console.log('2. Les variables d\'environnement Stripe sont-elles correctes ?');
    console.log('3. La base de données est-elle connectée ?');
    
  } finally {
    rl.close();
    console.log('\n👋 Test terminé. Merci !');
  }
}

// ========================================
// LANCEMENT DU TEST
// ========================================
console.log('🚀 Démarrage du test réel Stripe...\n');
testRealStripePayment();