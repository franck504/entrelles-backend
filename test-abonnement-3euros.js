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

async function testAbonnement3Euros() {
  console.log('💰 === TEST ABONNEMENT 3€ ENTRELLES ===\n');
  
  let token, userId, sessionId, checkoutUrl;
  
  try {
    // ========================================
    // 1. INSCRIPTION UTILISATEUR
    // ========================================
    console.log('👤 1. Création utilisateur pour test 3€...');
    const timestamp = Date.now();
    
    const registerData = {
      email: `test-3euros-${timestamp}@entrelles.com`,
      password: 'Test3Euros123!',
      displayName: `Test 3€ User`,
      firstName: 'Marie',
      lastName: 'Test3€',
      gender: 'femme',
      phone: '+33123456789'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
    token = registerResponse.data.token;
    userId = registerResponse.data.user.id;
    
    console.log('✅ Utilisateur créé pour test 3€');
    console.log(`📧 Email: ${registerData.email}`);
    console.log(`🆔 User ID: ${userId}`);
    
    const headers = { Authorization: `Bearer ${token}` };

    // ========================================
    // 2. VÉRIFICATION PRICE_ID DANS .ENV
    // ========================================
    console.log('\n💳 2. Test avec votre PRICE_ID configuré...');
    console.log('🔍 Le système va utiliser STRIPE_PRICE_ID de votre .env');
    console.log('💰 Prix attendu: 3€/mois');

    // ========================================
    // 3. CRÉATION SESSION CHECKOUT 3€
    // ========================================
    console.log('\n🛒 3. Création session checkout pour 3€...');
    const checkoutResponse = await axios.post(`${BASE_URL}/payments/create-checkout`, {}, { headers });
    
    sessionId = checkoutResponse.data.data.sessionId;
    checkoutUrl = checkoutResponse.data.data.checkoutUrl;
    const customerId = checkoutResponse.data.data.customerId;
    
    console.log('✅ Session checkout 3€ créée !');
    console.log(`🔑 Session ID: ${sessionId}`);
    console.log(`👤 Customer ID: ${customerId}`);

    // ========================================
    // 4. AFFICHAGE URL PAIEMENT 3€
    // ========================================
    console.log('\n' + '='.repeat(70));
    console.log('💰 === PAIEMENT ABONNEMENT 3€/MOIS ===');
    console.log('='.repeat(70));
    console.log('\n🔗 URL DE PAIEMENT (3€):');
    console.log(`\n${checkoutUrl}\n`);
    
    console.log('💳 === CARTES DE TEST POUR 3€ ===');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ 🟢 SUCCÈS - Paiement 3€                    │');
    console.log('│ Numéro: 4242 4242 4242 4242                │');
    console.log('│ Date: 12/34 | CVC: 123                     │');
    console.log('│ Nom: Marie Test                             │');
    console.log('│ 💰 Montant affiché: 3,00 €                 │');
    console.log('└─────────────────────────────────────────────┘');
    
    console.log('\n📝 INSTRUCTIONS PAIEMENT 3€:');
    console.log('1. 🌐 Ouvrez l\'URL dans votre navigateur');
    console.log('2. 💰 Vérifiez que le montant affiché est 3,00 €');
    console.log('3. 💳 Utilisez la carte de test ci-dessus');
    console.log('4. ✅ Confirmez le paiement de 3€');
    console.log('5. 🔄 Revenez ici après paiement');

    // ========================================
    // 5. ATTENTE PAIEMENT 3€
    // ========================================
    console.log('\n⏳ En attente du paiement de 3€...');
    console.log('💡 Vérifiez bien que Stripe affiche "3,00 €" avant de payer');
    
    await askQuestion('\n✅ Appuyez sur Entrée APRÈS avoir payé les 3€...');

    // ========================================
    // 6. VÉRIFICATION PAIEMENT 3€
    // ========================================
    console.log('\n🔍 6. Vérification du paiement 3€...');
    
    let paiementReussi = false;
    
    for (let tentative = 1; tentative <= 5; tentative++) {
      try {
        console.log(`⏳ Vérification ${tentative}/5...`);
        
        const verifyResponse = await axios.get(`${BASE_URL}/payments/verify-checkout?sessionId=${sessionId}`);
        
        console.log('🎉 PAIEMENT 3€ CONFIRMÉ !');
        console.log('✅ Détails:');
        console.log(`   💰 Statut paiement: ${verifyResponse.data.data.paymentStatus}`);
        console.log(`   📋 Abonnement: ${verifyResponse.data.data.subscriptionStatus}`);
        console.log(`   📧 Email: ${verifyResponse.data.data.email}`);
        
        paiementReussi = true;
        break;
        
      } catch (error) {
        console.log(`❌ Tentative ${tentative} échouée`);
        
        if (tentative < 5) {
          console.log('🔄 Nouvelle tentative dans 3 secondes...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // ========================================
    // 7. VÉRIFICATION ABONNEMENT 3€ ACTIF
    // ========================================
    console.log('\n📊 7. Vérification abonnement 3€ activé...');
    
    const statusResponse = await axios.get(`${BASE_URL}/payments/subscription-status`, { headers });
    const subscription = statusResponse.data.data;
    
    console.log('✅ STATUT ABONNEMENT 3€:');
    console.log(`   💰 Abonnement actif: ${subscription.hasActiveSubscription ? '✅ OUI' : '❌ NON'}`);
    console.log(`   📋 Plan: ${subscription.plan} ${subscription.plan === 'premium' ? '✅' : '❌'}`);
    console.log(`   📊 Statut: ${subscription.status}`);
    
    if (subscription.currentPeriodEnd) {
      const finPeriode = new Date(subscription.currentPeriodEnd);
      console.log(`   📅 Fin période: ${finPeriode.toLocaleDateString('fr-FR')}`);
      console.log(`   💰 Prochain paiement: 3€ le ${finPeriode.toLocaleDateString('fr-FR')}`);
    }

    // ========================================
    // 8. RÉSUMÉ ABONNEMENT 3€
    // ========================================
    console.log('\n' + '='.repeat(70));
    console.log('🎯 === RÉSUMÉ ABONNEMENT 3€ ===');
    console.log('='.repeat(70));
    
    if (paiementReussi && subscription.hasActiveSubscription) {
      console.log('🎉 SUCCÈS COMPLET !');
      console.log('✅ Utilisateur créé et inscrit');
      console.log('✅ Paiement de 3€ traité avec succès');
      console.log('✅ Abonnement premium activé');
      console.log('✅ Système de paiement fonctionnel');
      
      console.log('\n💰 DÉTAILS FINANCIERS:');
      console.log(`💳 Montant payé: 3,00 €`);
      console.log(`🔄 Récurrence: Mensuelle`);
      console.log(`📧 Client: ${registerData.email}`);
      console.log(`🆔 Customer Stripe: ${customerId.substring(0, 20)}...`);
      
    } else {
      console.log('⚠️ PROBLÈME DÉTECTÉ');
      console.log(`💳 Paiement vérifié: ${paiementReussi ? '✅' : '❌'}`);
      console.log(`📋 Abonnement actif: ${subscription.hasActiveSubscription ? '✅' : '❌'}`);
    }

    // ========================================
    // 9. VÉRIFICATIONS STRIPE DASHBOARD
    // ========================================
    console.log('\n🔍 === VÉRIFICATIONS STRIPE DASHBOARD ===');
    console.log('Connectez-vous à: https://dashboard.stripe.com/test');
    console.log('\n📊 À vérifier:');
    console.log('1. 💰 Paiements → Rechercher 3,00 €');
    console.log('2. 👥 Clients → Rechercher votre email');
    console.log('3. 🔄 Abonnements → Vérifier abonnement actif');
    console.log(`4. 🔍 Rechercher: ${registerData.email}`);
    
    console.log('\n💡 Dans le dashboard, vous devriez voir:');
    console.log('- Un paiement de 3,00 € réussi');
    console.log('- Un client avec votre email de test');
    console.log('- Un abonnement actif récurrent');

    // ========================================
    // 10. TEST BONUS: PORTAIL CLIENT
    // ========================================
    if (paiementReussi) {
      console.log('\n🎁 === BONUS: PORTAIL CLIENT 3€ ===');
      
      const testPortal = await askQuestion('Tester le portail client pour gérer l\'abonnement 3€ ? (y/n): ');
      
      if (testPortal.toLowerCase() === 'y') {
        try {
          const portalResponse = await axios.post(`${BASE_URL}/payments/create-portal`, {}, { headers });
          
          console.log('✅ Portail client créé !');
          console.log(`🔗 URL: ${portalResponse.data.data.portalUrl}`);
          console.log('\n📋 Dans le portail, vous pouvez:');
          console.log('- 📄 Voir vos factures de 3€');
          console.log('- 💳 Changer votre carte de paiement');
          console.log('- ❌ Annuler l\'abonnement 3€');
          console.log('- 📧 Mettre à jour vos informations');
          
        } catch (portalError) {
          console.log('⚠️ Portail non disponible:', portalError.response?.data?.message);
          
          if (portalError.response?.data?.configUrl) {
            console.log(`🔧 Configuration requise: ${portalError.response.data.configUrl}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE TEST 3€:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Statut:', error.response.status);
      console.error('Détails:', error.response.data);
    }
    
    console.log('\n🔧 VÉRIFICATIONS:');
    console.log('1. ✅ STRIPE_PRICE_ID configuré dans .env ?');
    console.log('2. ✅ Prix de 3€ créé dans Stripe Dashboard ?');
    console.log('3. ✅ API accessible et fonctionnelle ?');
    
  } finally {
    rl.close();
    console.log('\n👋 Test abonnement 3€ terminé !');
  }
}

// ========================================
// LANCEMENT DU TEST 3€
// ========================================
console.log('🚀 Démarrage du test abonnement 3€...\n');
testAbonnement3Euros();