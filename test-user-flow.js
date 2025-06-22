require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

// ✅ CORRECTION URL DE BASE
const API_BASE_URL = 'http://localhost:3000/api'; // Force local pour tests
// Ou si vous voulez utiliser ngrok :
// const API_BASE_URL = 'https://f043-129-222-109-170.ngrok-free.app/api';

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const TEST_EMAIL = 'alice.test@entrelles.com';
const TEST_PASSWORD = 'TestPassword123!';

// Variables globales
let userToken = null;
let userId = null;
let tripId = null;
let passengerToken = null;
let passengerId = null;
let bookingId = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utilitaires de logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  step: (msg) => console.log(`\n${colors.cyan}🔄 ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  separator: () => console.log('='.repeat(60))
};

// ✅ FONCTION API REQUEST CORRIGÉE
const apiRequest = async (method, endpoint, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(data && { data }),
      timeout: 15000
    };

    log.info(`${method.toUpperCase()} ${endpoint}`);
    console.log(`🔗 URL complète: ${config.url}`);
    
    if (data) {
      console.log('📤 Données:', JSON.stringify(data, null, 2));
    }

    const response = await axios(config);
    log.success(`Réponse: ${response.status}`);
    console.log('📥 Données reçues:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    if (error.response) {
      log.error(`Erreur API: ${error.response.status} - ${error.response.statusText}`);
      console.log('📥 Détails:', JSON.stringify(error.response.data, null, 2));
      return { 
        error: true, 
        status: error.response.status,
        data: error.response.data 
      };
    } else if (error.code === 'ECONNREFUSED') {
      log.error('❌ SERVEUR NON ACCESSIBLE !');
      console.log('🔧 Vérifiez que le serveur est démarré :');
      console.log('   npm run dev');
      console.log('   ou');
      console.log('   node index.js');
      return { error: true, message: 'Serveur non accessible' };
    } else {
      log.error(`Erreur réseau: ${error.message}`);
      return { error: true, message: error.message };
    }
  }
};

// Attendre input utilisateur
const waitForEnter = (message = 'Appuyez sur Entrée pour continuer...') => {
  return new Promise((resolve) => {
    rl.question(`\n${colors.yellow}${message}${colors.reset}`, resolve);
  });
};

// ✅ TEST DE CONNEXION SERVEUR
const testServerConnection = async () => {
  log.step('TEST PRÉALABLE: Connexion serveur');
  log.separator();
  
  try {
    // Test de l'endpoint de santé
    const healthUrl = API_BASE_URL.replace('/api', '/health');
    console.log(`🔗 Test connexion: ${healthUrl}`);
    
    const response = await axios.get(healthUrl, { timeout: 5000 });
    
    if (response.status === 200) {
      log.success('Serveur accessible et opérationnel');
      console.log('📊 Infos serveur:', JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error('Serveur non accessible');
    console.log('🔧 Actions à faire :');
    console.log('  1. Démarrer le serveur : npm run dev');
    console.log('  2. Vérifier le port : http://localhost:3000');
    console.log('  3. Vérifier les variables d\'environnement');
    return false;
  }
};

// ÉTAPE 1: Vérifier utilisateur
const checkUserExists = async () => {
  log.step('ÉTAPE 1: Vérification utilisateur');
  log.separator();
  
  const result = await apiRequest('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  
  if (result.success) {
    log.success('Utilisateur trouvé et connecté');
    userToken = result.token;
    userId = result.user.id;
    return true;
  } else if (result.status === 401) {
    log.warning('Utilisateur n\'existe pas ou mot de passe incorrect');
    return false;
  } else {
    log.error('Erreur lors de la vérification');
    return false;
  }
};

// ÉTAPE 2: Créer utilisateur
const createUser = async () => {
  log.step('ÉTAPE 2: Création utilisateur');
  log.separator();
  
  const userData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    displayName: 'Alice Conductrice',
    firstName: 'Alice',
    lastName: 'Conductrice',
    gender: 'femme',
    phone: '+33123456789',
    dateOfBirth: '1990-05-15'
  };
  
  const result = await apiRequest('POST', '/auth/register', userData);
  
  if (result.success) {
    log.success('Utilisateur créé avec succès');
    userToken = result.token;
    userId = result.user.id;
    console.log(`👤 ID: ${userId}`);
    console.log(`📧 Email: ${result.user.email}`);
    return true;
  } else {
    log.error('Échec création utilisateur');
    if (result.data?.errors) {
      console.log('Erreurs:', result.data.errors);
    }
    return false;
  }
};

// ÉTAPE 3: Vérifier abonnement
const checkSubscription = async () => {
  log.step('ÉTAPE 3: Vérification abonnement');
  log.separator();
  
  const result = await apiRequest('GET', '/payments/subscription-status', null, userToken);
  
  if (result.success && result.subscription?.isActive) {
    log.success('Abonnement actif trouvé');
    console.log(`📋 Plan: ${result.subscription.plan}`);
    console.log(`📋 Status: ${result.subscription.status}`);
    return true;
  } else {
    log.warning('Aucun abonnement actif');
    return false;
  }
};

// ÉTAPE 4: Créer abonnement RÉEL
const createSubscription = async () => {
  log.step('ÉTAPE 4: Création abonnement RÉEL');
  log.separator();
  
  if (!STRIPE_PRICE_ID) {
    log.error('STRIPE_PRICE_ID manquant dans .env');
    return false;
  }
  
  const result = await apiRequest('POST', '/payments/create-subscription', {
    priceId: STRIPE_PRICE_ID
  }, userToken);
  
  if (result.success) {
    log.success('Abonnement créé');
    console.log(`💳 Subscription ID: ${result.subscription.id}`);
    
    // Finaliser l'abonnement
    const setupResult = await apiRequest('POST', '/payments/complete-subscription-setup', {
      subscriptionId: result.subscription.id
    }, userToken);
    
    if (setupResult.success) {
      log.success('Abonnement activé');
      return true;
    } else {
      log.error('Échec activation abonnement');
      return false;
    }
  } else {
    log.error('Échec création abonnement');
    console.log('Détails:', result.data);
    return false;
  }
};

// ÉTAPE 5: Vérifier KYC
const checkKYCStatus = async () => {
  log.step('ÉTAPE 5: Vérification KYC');
  log.separator();
  
  const result = await apiRequest('GET', '/kyc/status', null, userToken);
  
  if (result.success && result.kyc?.canReceivePayments) {
    log.success('KYC vérifié - Peut recevoir des paiements');
    console.log(`📋 Status: ${result.kyc.status}`);
    console.log(`📋 Connect Account: ${result.kyc.connectAccountId || 'Non créé'}`);
    return true;
  } else {
    log.warning('KYC non vérifié');
    if (result.kyc) {
      console.log(`📋 Status actuel: ${result.kyc.status}`);
      console.log(`📋 Message: ${result.kyc.message}`);
    }
    return false;
  }
};

// ÉTAPE 6: Démarrer KYC
const startKYCProcess = async () => {
  log.step('ÉTAPE 6: Démarrage processus KYC');
  log.separator();
  
  const result = await apiRequest('POST', '/kyc/start', {}, userToken);
  
  if (result.success) {
    log.success('Processus KYC démarré');
    console.log(`🔗 Onboarding URL: ${result.onboarding?.url || 'Non fourni'}`);
    console.log(`📋 Connect Account: ${result.connectAccount?.id || 'Non créé'}`);
    
    if (result.onboarding?.url) {
      console.log('\n🔗 Lien d\'onboarding Stripe:');
      console.log(result.onboarding.url);
      await waitForEnter('Complétez l\'onboarding Stripe puis appuyez sur Entrée...');
      
      // Vérifier le statut après onboarding
      const statusResult = await apiRequest('GET', '/kyc/status', null, userToken);
      if (statusResult.success && statusResult.kyc?.canReceivePayments) {
        log.success('KYC complété avec succès !');
        return true;
      } else {
        log.warning('KYC pas encore complété, continuons quand même...');
        return true; // On continue pour tester
      }
    }
    
    return true;
  } else {
    log.error('Échec démarrage KYC');
    console.log('Détails:', result.data);
    return false;
  }
};

// ÉTAPE 7: Créer trajet
const createTrip = async () => {
  log.step('ÉTAPE 7: Création trajet');
  log.separator();
  
  const tripData = {
    departure: { 
      city: 'Paris', 
      address: 'Gare de Lyon, 75012 Paris' 
    },
    arrival: { 
      city: 'Lyon', 
      address: 'Gare Part-Dieu, 69003 Lyon' 
    },
    departureDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    availableSeats: 3,
    distance: 465,
    pricePerSeat: 25.50,
    description: 'Trajet test Paris-Lyon, ambiance détendue',
    preferences: {
      allowSmoking: false,
      allowPets: true,
      musicPreference: 'medium'
    }
  };
  
  const result = await apiRequest('POST', '/trips', tripData, userToken);
  
  if (result.success) {
    log.success('Trajet créé avec succès');
    tripId = result.trip.id;
    console.log(`🚗 Trip ID: ${tripId}`);
    console.log(`📍 Route: ${result.trip.departure.city} → ${result.trip.arrival.city}`);
    console.log(`💰 Prix: ${result.trip.pricePerSeat}€/place`);
    console.log(`🪑 Places: ${result.trip.availableSeats}`);
    return true;
  } else {
    log.error('Échec création trajet');
    console.log('Détails:', result.data);
    return false;
  }
};

// ÉTAPE 8: Créer passagère de test
const createPassenger = async () => {
  log.step('ÉTAPE 8: Création passagère de test');
  log.separator();
  
  const passengerData = {
    email: 'marie.passagere@entrelles.com',
    password: 'TestPassword123!',
    displayName: 'Marie Passagère',
    firstName: 'Marie',
    lastName: 'Passagère',
    gender: 'femme',
    phone: '+33123456790'
  };
  
  // D'abord essayer de se connecter
  let loginResult = await apiRequest('POST', '/auth/login', {
    email: passengerData.email,
    password: passengerData.password
  });
  
  if (!loginResult.success) {
    // Créer la passagère
    const registerResult = await apiRequest('POST', '/auth/register', passengerData);
    
    if (registerResult.success) {
      log.success('Passagère créée');
      passengerToken = registerResult.token;
      passengerId = registerResult.user.id;
    } else {
      log.error('Échec création passagère');
      return false;
    }
  } else {
    log.success('Passagère existante connectée');
    passengerToken = loginResult.token;
    passengerId = loginResult.user.id;
  }
  
  // Créer abonnement pour la passagère
  const subResult = await apiRequest('POST', '/payments/create-subscription', {
    priceId: STRIPE_PRICE_ID
  }, passengerToken);
  
  if (subResult.success) {
    await apiRequest('POST', '/payments/complete-subscription-setup', {
      subscriptionId: subResult.subscription.id
    }, passengerToken);
    log.success('Passagère abonnée');
  }
  
  return true;
};

// ÉTAPE 9: Créer réservation
const createBooking = async () => {
  log.step('ÉTAPE 9: Création réservation');
  log.separator();
  
  if (!tripId || !passengerToken) {
    log.error('Trip ID ou token passagère manquant');
    return false;
  }
  
  const bookingData = {
    tripId: tripId,
    numberOfSeats: 2,
    message: 'Bonjour ! J\'aimerais réserver 2 places pour ce trajet. Merci !'
  };
  
  const result = await apiRequest('POST', '/bookings', bookingData, passengerToken);
  
  if (result.success) {
    log.success('Réservation créée');
    bookingId = result.booking.id;
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`🪑 Places réservées: ${result.booking.numberOfSeats}`);
    console.log(`💰 Prix total: ${result.booking.totalPrice}€`);
    return true;
  } else {
    log.error('Échec création réservation');
    console.log('Détails:', result.data);
    return false;
  }
};

// ÉTAPE 10: Créer paiement
const createPayment = async () => {
  log.step('ÉTAPE 10: Création paiement trajet');
  log.separator();
  
  if (!bookingId) {
    log.error('Booking ID manquant');
    return false;
  }
  
  const result = await apiRequest('POST', '/payments/create-trip-payment', {
    bookingId: bookingId
  }, passengerToken);
  
  if (result.success) {
    log.success('Paiement créé');
    console.log(`💳 Payment Intent: ${result.paymentIntent.id}`);
    console.log(`💰 Montant: ${result.paymentIntent.amount / 100}€`);
    console.log(`🔗 Client Secret: ${result.paymentIntent.clientSecret ? 'Fourni' : 'Non fourni'}`);
    
    // Finaliser le paiement
    const finalizeResult = await apiRequest('POST', '/payments/finalize-trip-payment', {
      bookingId: bookingId,
      paymentMethodId: 'pm_card_visa' // Carte de test Stripe
    }, passengerToken);
    
    if (finalizeResult.success) {
      log.success('Paiement finalisé avec succès !');
      console.log(`📋 Status: ${finalizeResult.booking.status}`);
      console.log(`💰 Montant payé: ${finalizeResult.booking.payment.amount / 100}€`);
      return true;
    } else {
      log.error('Échec finalisation paiement');
      console.log('Détails:', finalizeResult.data);
      return false;
    }
  } else {
    log.error('Échec création paiement');
    console.log('Détails:', result.data);
    return false;
  }
};

// FONCTION PRINCIPALE
const runCompleteUserFlow = async () => {
  try {
    console.log(`${colors.bright}${colors.blue}🚗 ENTRELLES - TEST COMPLET RÉEL${colors.reset}\n`);
    
    // Vérification préalable
    const serverOk = await testServerConnection();
    if (!serverOk) {
      log.error('Impossible de continuer sans serveur accessible');
      return;
    }
    
    await waitForEnter('Serveur OK. Appuyez sur Entrée pour continuer...');
    
    // Configuration
    if (!STRIPE_PRICE_ID) {
      log.error('STRIPE_PRICE_ID manquant dans .env');
      return;
    }
    
    log.info(`Configuration: Price ID = ${STRIPE_PRICE_ID}`);
    log.info(`API Base URL = ${API_BASE_URL}`);
    
    // ✅ FLOW COMPLET
    // 1. Utilisateur (conductrice)
    const userExists = await checkUserExists();
    if (!userExists) {
      const created = await createUser();
      if (!created) return;
    }
    
    await waitForEnter('Utilisateur OK. Continuer avec l\'abonnement...');
    
    // 2. Abonnement conductrice
    const hasSubscription = await checkSubscription();
    if (!hasSubscription) {
      const created = await createSubscription();
      if (!created) return;
    }
    
    await waitForEnter('Abonnement OK. Continuer avec le KYC...');
    
    // 3. KYC conductrice
    const hasKYC = await checkKYCStatus();
    if (!hasKYC) {
      const started = await startKYCProcess();
      if (!started) return;
    }
    
    await waitForEnter('KYC OK. Continuer avec la création de trajet...');
    
    // 4. Créer trajet
    const tripCreated = await createTrip();
    if (!tripCreated) return;
    
    await waitForEnter('Trajet créé. Continuer avec la passagère...');
    
    // 5. Créer passagère
    const passengerCreated = await createPassenger();
    if (!passengerCreated) return;
    
    await waitForEnter('Passagère OK. Continuer avec la réservation...');
    
    // 6. Créer réservation
    const bookingCreated = await createBooking();
    if (!bookingCreated) return;
    
    await waitForEnter('Réservation créée. Continuer avec le paiement...');
    
    // 7. Créer et finaliser paiement
    const paymentCompleted = await createPayment();
    if (paymentCompleted) {
      log.success('🎉🎉🎉 TEST COMPLET RÉUSSI ! 🎉🎉🎉');
      console.log('\n📊 RÉSUMÉ DU TEST:');
      console.log(`👤 Conductrice: ${userId}`);
      console.log(`👤 Passagère: ${passengerId}`);
      console.log(`🚗 Trajet: ${tripId}`);
      console.log(`📋 Réservation: ${bookingId}`);
      console.log(`💳 Paiement: Complété`);
      console.log('\n✅ Toute la chaîne fonctionne parfaitement !');
    }
    
  } catch (error) {
    log.error('Erreur critique:', error.message);
  } finally {
    rl.close();
  }
};

// Démarrage
if (require.main === module) {
  runCompleteUserFlow();
}