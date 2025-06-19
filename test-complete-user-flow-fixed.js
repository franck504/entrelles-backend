const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let tokens = {};
let userData = {};
let tripData = {};
let bookingData = {};

// Données de test uniques
const timestamp = Date.now();
const testUsers = {
  driver: {
    email: `Raseheno5@test.com`,
    password: '123azeqsD',
    displayName: 'Raseheno Conductrice',
    firstName: 'Raseheno',
    lastName: 'Raseheno',
    gender: 'femme',
    phone: '0612345678'
  },
  passenger: {
    email: `Raketaka5@test.com`,
    password: '123azeqsD',
    displayName: 'Raketaka Passagère',
    firstName: 'Raketaka',
    lastName: 'Raketaka',
    gender: 'femme',
    phone: '0687654321'
  }
};

const testTrip = {
  departure: {
    city: 'Paris',
    address: 'Tour eiffel',
    coordinates: { lat: 45.7640, lng: 4.8357 }
  },
  arrival: {
    city: 'Marseille',
    address: 'Gare Saint-Charles, 13001 Marseille',
    coordinates: { lat: 43.2965, lng: 5.3698 }
  },
  departureDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  estimatedDuration: 195,
  availableSeats: 2,
  distance: 65,
  description: 'Trajet Paris-Marseille, départ ponctuel. Bonne ambiance garantie !'
};

// Fonctions utilitaires
const makeRequest = async (method, endpoint, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(data && { data })
    };

    console.log(`🔍 Making ${method} request to: ${BASE_URL}${endpoint}`);
    if (token) {
      console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
    }
    if (data) {
      console.log(`📤 Request data:`, JSON.stringify(data, null, 2));
    }

    const response = await axios(config);
    
    console.log(`📥 Response status: ${response.status}`);
    console.log(`📥 Response data:`, JSON.stringify(response.data, null, 2));

    return {
      success: true,
      status: response.status,
      data: response.data,
      error: null
    };

  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    
    if (error.response) {
      console.log(`📥 Error status: ${error.response.status}`);
      console.log(`📥 Error data:`, JSON.stringify(error.response.data, null, 2));
      
      return {
        success: false,
        status: error.response.status,
        data: null,
        error: error.response.data
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

const logStep = (step, description) => {
  console.log(`\n🔹 ÉTAPE ${step}: ${description}`);
  console.log('─'.repeat(50));
};

const logResult = (success, data) => {
  if (success) {
    console.log('✅ SUCCÈS');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('❌ ÉCHEC');
    console.log(JSON.stringify(data, null, 2));
  }
};

// ✅ FONCTION D'ATTENTE SIMPLIFIÉE (optionnelle)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test complet automatique
const runCompleteUserFlow = async () => {
  console.log('🚀 DÉBUT DES TESTS COMPLETS USER FLOW AVEC FINALISATION AUTOMATIQUE');
  console.log(`📅 Test ID: ${timestamp}`);
  console.log('═'.repeat(70));

  try {
    // PARTIE CONDUCTRICE
    logStep(1, 'Inscription de la conductrice');
    const driverRegister = await makeRequest('POST', '/auth/register', testUsers.driver);
    logResult(driverRegister.success, driverRegister.data || driverRegister.error);
    
    if (!driverRegister.success) throw new Error('Driver registration failed');
    tokens.driver = driverRegister.data.token;
    userData.driver = driverRegister.data.user;

    logStep(2, 'Création du trajet par la conductrice');
    const tripCreate = await makeRequest('POST', '/trips', testTrip, tokens.driver);
    logResult(tripCreate.success, tripCreate.data || tripCreate.error);
    
    if (!tripCreate.success) throw new Error('Trip creation failed');
    tripData = tripCreate.data.trip;

    // PARTIE PASSAGÈRE
    logStep(3, 'Inscription de la passagère');
    const passengerRegister = await makeRequest('POST', '/auth/register', testUsers.passenger);
    logResult(passengerRegister.success, passengerRegister.data || passengerRegister.error);
    
    if (!passengerRegister.success) throw new Error('Passenger registration failed');
    tokens.passenger = passengerRegister.data.token;
    userData.passenger = passengerRegister.data.user;

    logStep(4, 'Recherche de trajets par la passagère');
    const searchParams = `?departureCity=Paris&arrivalCity=Marseille&passengers=1`;
    const tripSearch = await makeRequest('GET', `/trips/search${searchParams}`, null, tokens.passenger);
    logResult(tripSearch.success, tripSearch.data || tripSearch.error);

    logStep(5, 'Demande de réservation par la passagère');
    const bookingRequest = {
      tripId: tripData.id,
      numberOfSeats: 1,
      message: 'Bonjour ! Je souhaiterais réserver une place pour Marseille. Merci beaucoup !'
    };
    
    const bookingCreate = await makeRequest('POST', '/bookings', bookingRequest, tokens.passenger);
    logResult(bookingCreate.success, bookingCreate.data || bookingCreate.error);
    
    if (!bookingCreate.success) throw new Error('Booking creation failed');
    bookingData = bookingCreate.data.booking;

    // ✅ ÉTAPE 6 : Confirmation par la conductrice AVEC création PaymentIntent
    logStep(6, 'Confirmation par la conductrice avec paiement');
    console.log(`👩‍🚗 La conductrice ${userData.driver.profile.displayName} confirme la réservation`);
    console.log(`📋 Booking ID: ${bookingData.id}`);
    console.log(`👩‍💼 Passagère: ${userData.passenger.profile.displayName}`);
    console.log(`💰 Montant: ${bookingData.totalPrice}€`);

    // ✅ CONFIRMATION AVEC PAIEMENT EN UNE SEULE ÉTAPE
    const confirmResult = await makeRequest('PUT', `/bookings/${bookingData.id}/confirm`, 
      { requiresPayment: true }, tokens.driver);

    if (confirmResult.success) {
      logResult(confirmResult.success, confirmResult.data, 'confirm');
      bookingData = confirmResult.data.booking;
      console.log('\n🎉 CONFIRMATION + PAYMENTINTENT CRÉÉS !');
      console.log(`✅ Status: ${bookingData.status}`);
      console.log(`🔑 PaymentIntent: ${bookingData.payment?.stripePaymentIntentId || 'N/A'}`);
    } else {
      throw new Error('Booking confirmation with payment failed');
    }

    // ✅ SIMULATION DU VOYAGE (automatique)
    console.log('\n🚗 SIMULATION DU VOYAGE...');
    console.log('═'.repeat(50));
    console.log('📍 Trajet:', `${tripData.departure.city} → ${tripData.arrival.city}`);
    console.log('👩‍🚗 Conductrice:', userData.driver.profile.displayName);
    console.log('👩‍💼 Passagère:', userData.passenger.profile.displayName);
    console.log('💰 Montant à payer:', `${bookingData.totalPrice}€`);
    console.log('🔑 PaymentIntent ID:', bookingData.payment?.stripePaymentIntentId || 'N/A');

    if (bookingData.payment?.stripePaymentIntentId) {
      console.log('\n💳 STATUT PAIEMENT ACTUEL:');
      console.log(' • Stripe: requires_payment_method (en attente)');
      console.log(' • Réservation: pending (confirmée mais pas payée)');
      console.log(' • PaymentIntent créé et prêt pour finalisation');
    }

    // ✅ ATTENTE COURTE POUR SIMULATION
    console.log('\n⏳ Simulation du voyage en cours (3 secondes)...');
    await sleep(3000);
    console.log('🏁 Voyage terminé ! Finalisation du paiement...');

    // ✅ ÉTAPE 7 : FINALISATION PAIEMENT (UNE SEULE MÉTHODE)
    logStep(7, 'Finalisation paiement par la passagère');

    if (bookingData.payment?.stripePaymentIntentId) {
      console.log('🔍 PRÉPARATION PAIEMENT:');
      console.log(`📋 Booking: ${bookingData.id}`);
      console.log(`🔑 PaymentIntent: ${bookingData.payment.stripePaymentIntentId}`);
      
      // ✅ UTILISER SEULEMENT finalize-trip-payment
      const finalizationData = {
        bookingId: bookingData.id,
        paymentMethodId: 'pm_card_visa'
      };

      console.log('💳 Finalisation du paiement...');
      const finalizeResult = await makeRequest('POST', '/payments/finalize-trip-payment', 
        finalizationData, tokens.passenger);

      if (finalizeResult.success) {
        logResult(true, finalizeResult.data, 'payment');
        bookingData = finalizeResult.data.booking;
        console.log('\n🎉 PAIEMENT FINALISÉ AVEC SUCCÈS !');
        console.log(`✅ Booking Status: ${bookingData.status}`);
        console.log(`💳 Payment Status: ${bookingData.payment?.status}`);
        console.log(`💰 Amount: ${bookingData.payment?.amount}€`);
      } else {
        throw new Error('Payment finalization failed');
      }
    } else {
      throw new Error('No PaymentIntent found for payment finalization');
    }

    // VÉRIFICATIONS FINALES
    logStep(7, 'Vérifications finales');
    const finalBookingCheck = await makeRequest('GET', `/bookings/${bookingData.id}`, null, tokens.passenger);
    logResult(finalBookingCheck.success, finalBookingCheck.data || finalBookingCheck.error);

    // ✅ RÉSUMÉ FINAL
    console.log('\n🎉 TESTS COMPLETS TERMINÉS !');
    console.log('═'.repeat(70));
    console.log('📊 RÉSUMÉ FINAL :');
    console.log('👩‍🚗 Conductrice :', userData.driver.profile.displayName, `(${userData.driver.email})`);
    console.log('👩‍💼 Passagère :', userData.passenger.profile.displayName, `(${userData.passenger.email})`);
    console.log('🚗 Trajet :', `${tripData.departure.city} → ${tripData.arrival.city}`);
    console.log('📏 Distance :', `${tripData.distance} km`);
    console.log('💳 Réservation :', bookingData.id);
    console.log('💰 Montant :', `${bookingData.totalPrice}€`);

    console.log('\n🎯 STATUT FINAL :');
    console.log('✅ Utilisateurs créés avec emails uniques');
    console.log('✅ Trajet créé avec calcul automatique du prix');
    console.log('✅ Réservation confirmée avec PaymentIntent');
    console.log('✅ Voyage simulé automatiquement');
    console.log('✅ Paiement finalisé sans intervention manuelle');
    console.log('✅ Transaction Stripe complète');

    console.log('\n🎉 FLOW COMPLET AUTOMATIQUE RÉUSSI !');

  } catch (error) {
    console.error('\n❌ ERREUR DANS LE FLOW :', error.message);
    console.error('Stack:', error.stack);
  }
};

// Lancer le test automatique
runCompleteUserFlow();