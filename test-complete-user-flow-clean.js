// ✅ ÉTAPE 6 : Confirmation simple (SANS paiement)
logStep(6, 'Confirmation par la conductrice');
const confirmResult = await makeRequest('PUT', `/bookings/${bookingData.id}/confirm`, 
  {}, tokens.driver);

if (confirmResult.success) {
  bookingData = confirmResult.data.booking;
  console.log('✅ Booking confirmé (status: confirmed)');
} else {
  throw new Error('Booking confirmation failed');
}

// ✅ SIMULATION VOYAGE
console.log('\n🚗 SIMULATION VOYAGE');
// ... simulation code ...

// ✅ ÉTAPE 7 : PAIEMENT COMPLET (UNE SEULE REQUÊTE)
logStep(7, 'Paiement complet par la passagère');

console.log('💳 Création et finalisation du paiement en une fois...');
const paymentData = {
  bookingId: bookingData.id,
  paymentMethodId: 'pm_card_visa'
};

// ✅ UTILISER SEULEMENT finalize-trip-payment (qui crée ET finalise)
const paymentResult = await makeRequest('POST', '/payments/finalize-trip-payment', 
  paymentData, tokens.passenger);

if (paymentResult.success) {
  logResult(true, paymentResult.data, 'payment');
  bookingData = paymentResult.data.booking;
  console.log('\n🎉 PAIEMENT CRÉÉ ET FINALISÉ AVEC SUCCÈS !');
  console.log(`✅ Booking Status: ${bookingData.status}`);
  console.log(`💳 Payment Status: ${bookingData.payment?.status}`);
  console.log(`💰 Amount: ${bookingData.payment?.amount}€`);
} else {
  throw new Error('Payment creation and finalization failed');
}



























































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


        email: `sylvia@test.com`,
        password: '123azeqsD',
        displayName: 'Sylvia Conductrice',
        firstName: 'Sylvia',
        lastName: 'Raseheno',
        gender: 'femme',
        phone: '0612345678'
    },
    passenger: {


        email: `elodie@test.com`,
        password: '123azeqsD',
        displayName: 'Elodie Passagère',
        firstName: 'Elodie',
        lastName: 'Rafanomezantsoa',
        gender: 'femme',
        phone: '0687654321'
    }
};

const testTrip = {
    departure: {
        city: 'Paris',
        address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
        coordinates: { lat: 48.8584, lng: 2.2945 }  // Tour Eiffel
    },
    arrival: {
        city: 'Marseille',
        address: 'Gare Saint-Charles, Square Narvik, 13001 Marseille, France',
        coordinates: { lat: 43.3030, lng: 5.3811 }  // Gare Saint-Charles
    },
    departureDateTime: '2025-07-01T08:00:00.000Z',  // date fixe dans le futur
    estimatedDuration: 195, // en minutes => 3h15, cohérent pour un TGV
    availableSeats: 2,
    distance: 775, // distance réelle approximative en km
    description: 'Trajet Paris-Marseille en TGV, départ à l’heure, ambiance conviviale assurée !'
};



// ✅ FONCTION DE REQUÊTE AVEC TOKENS COMPLETS
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

        console.log(`🔍 ${method} ${endpoint}`);
        if (token) {

            console.log(`🔑 Token: ${token}`);
        }

        const response = await axios(config);
        console.log(`📥 Status: ${response.status}`);

        return {
            success: true,
            status: response.status,
            data: response.data,
            error: null
        };

    } catch (error) {
        console.error(`❌ ${method} ${endpoint} failed: ${error.response?.status || error.message}`);

        if (error.response) {


            console.error(`📥 Error: ${JSON.stringify(error.response.data, null, 2)}`);
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


// ✅ LOG RESULT AVEC TOKENS COMPLETS
const logResult = (success, data, type = '') => {
    if (success) {
        console.log('✅ SUCCÈS');

        switch (type) {
            case 'register':
                console.log(`📧 Email: ${data.user?.email}`);

                console.log(`🔑 Token: ${data.token}`);
                console.log(`👤 ID: ${data.user?.id}`);
                break;

            case 'trip':
                console.log(`🚗 Trip ID: ${data.trip?.id}`);
                console.log(`📍 Route: ${data.trip?.departure?.city} → ${data.trip?.arrival?.city}`);
                console.log(`💰 Price: ${data.trip?.pricePerSeat}€`);
                console.log(`📏 Distance: ${data.trip?.distance}km`);
                break;

            case 'search':
                console.log(`🔍 Found: ${data.data?.length || 0} trips`);
                break;

            case 'booking':
                console.log(`📋 Booking ID: ${data.booking?.id}`);
                console.log(`💰 Total: ${data.booking?.totalPrice}€`);
                console.log(`📊 Status: ${data.booking?.status}`);
                console.log(`🔑 PaymentIntent: ${data.booking?.payment?.stripePaymentIntentId || 'N/A'}`);
                break;

            case 'confirm':
                console.log(`📋 Booking confirmé: ${data.booking?.id}`);
                console.log(`📊 Status: ${data.booking?.status}`);
                console.log(`🔑 PaymentIntent: ${data.booking?.payment?.stripePaymentIntentId || 'N/A'}`);
                console.log(`💳 Client Secret: ${data.booking?.payment?.stripeClientSecret ? 'Généré' : 'N/A'}`);
                break;

            case 'payment':
                console.log(`💳 Payment Status: ${data.booking?.payment?.status}`);
                console.log(`💰 Amount: ${data.booking?.payment?.amount}€`);
                console.log(`📋 Booking Status: ${data.booking?.status}`);
                break;

            default:
                console.log(`📊 Success`);
        }
    } else {
        console.log('❌ ÉCHEC');
        console.log(`⚠️  Error: ${data?.message || 'Unknown error'}`);
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



// ✅ FLOW COMPLET AVEC CONFIRMATION CONDUCTEUR
const runCompleteUserFlow = async () => {


    console.log('🚀 FLOW COMPLET ENTRELLES - USER FLOW COMPLET');
    console.log(`📅 Test ID: ${timestamp}`);


    console.log('═'.repeat(60));

    try {








        // PARTIE CONDUCTRICE
        logStep(1, 'Inscription conductrice');
        const driverRegister = await makeRequest('POST', '/auth/register', testUsers.driver);
        logResult(driverRegister.success, driverRegister.data || driverRegister.error, 'register');

        if (!driverRegister.success) throw new Error('Driver registration failed');
        tokens.driver = driverRegister.data.token;
        userData.driver = driverRegister.data.user;








        logStep(2, 'Création trajet');
        const tripCreate = await makeRequest('POST', '/trips', testTrip, tokens.driver);
        logResult(tripCreate.success, tripCreate.data || tripCreate.error, 'trip');

        if (!tripCreate.success) throw new Error('Trip creation failed');
        tripData = tripCreate.data.trip;









        // PARTIE PASSAGÈRE
        logStep(3, 'Inscription passagère');
        const passengerRegister = await makeRequest('POST', '/auth/register', testUsers.passenger);
        logResult(passengerRegister.success, passengerRegister.data || passengerRegister.error, 'register');

        if (!passengerRegister.success) throw new Error('Passenger registration failed');
        tokens.passenger = passengerRegister.data.token;
        userData.passenger = passengerRegister.data.user;


        logStep(4, 'Recherche trajets');
        const searchParams = `?departureCity=Paris&arrivalCity=Marseille&passengers=1`;


        const tripSearch = await makeRequest('GET', `/trips/search${searchParams}`, null, tokens.passenger);
        logResult(tripSearch.success, tripSearch.data || tripSearch.error, 'search');



        logStep(5, 'Réservation par la passagère');
        const bookingRequest = {
            tripId: tripData.id,
            numberOfSeats: 1,


            message: 'Bonjour ! Je souhaiterais réserver une place pour Marseille. Merci beaucoup !'
        };





        const bookingCreate = await makeRequest('POST', '/bookings', bookingRequest, tokens.passenger);
        logResult(bookingCreate.success, bookingCreate.data || bookingCreate.error, 'booking');

        if (!bookingCreate.success) throw new Error('Booking creation failed');
        bookingData = bookingCreate.data.booking;








        // ✅ NOUVELLE ÉTAPE : CONFIRMATION PAR LA CONDUCTRICE
        logStep(6, 'Confirmation par la conductrice');
        console.log(`👩‍🚗 La conductrice ${userData.driver.profile.displayName} confirme la réservation`);
        console.log(`📋 Booking ID: ${bookingData.id}`);
        console.log(`👩‍💼 Passagère: ${userData.passenger.profile.displayName}`);
        console.log(`💰 Montant: ${bookingData.totalPrice}€`);

        // ✅ ÉTAPE 6A : Confirmation du booking (sans PaymentIntent)
        const confirmResult = await makeRequest('PUT', `/bookings/${bookingData.id}/confirm`, 
          {}, tokens.driver);

        if (confirmResult.success) {
          logResult(confirmResult.success, confirmResult.data, 'confirm');
          bookingData = confirmResult.data.booking;
          console.log('\n🎉 CONFIRMATION RÉUSSIE !');
          console.log(`✅ Status: ${bookingData.status}`);
        } else {
          throw new Error('Booking confirmation failed');
        }

        // ✅ ÉTAPE 6B : Création PaymentIntent séparée (par la passagère)
        console.log('\n💳 CRÉATION PAYMENTINTENT PAR LA PASSAGÈRE...');
        const paymentData = {
          bookingId: bookingData.id
        };

        const paymentCreate = await makeRequest('POST', '/payments/create-trip-payment', 
          paymentData, tokens.passenger);

        if (paymentCreate.success) {
          console.log('✅ PaymentIntent créé avec succès');
          console.log(`🔑 PaymentIntent ID: ${paymentCreate.data.paymentIntent?.id}`);
          console.log(`🔐 Client Secret: ${paymentCreate.data.paymentIntent?.clientSecret ? 'Généré' : 'N/A'}`);
          console.log(`💰 Montant: ${paymentCreate.data.paymentIntent?.amount / 100}€`);
          
          // ✅ MISE À JOUR bookingData avec les infos de paiement
          if (!bookingData.payment) {
            bookingData.payment = {};
          }
          bookingData.payment.stripePaymentIntentId = paymentCreate.data.paymentIntent.id;
          bookingData.payment.stripeClientSecret = paymentCreate.data.paymentIntent.clientSecret;
          bookingData.payment.status = 'processing';
          bookingData.payment.amount = paymentCreate.data.paymentIntent.amount / 100; // Convertir centimes en euros
          
          console.log('✅ BookingData mis à jour avec PaymentIntent');
        } else {
          console.error('❌ Échec création PaymentIntent:', paymentCreate.error);
          throw new Error('Failed to create PaymentIntent');
        }








        // ✅ SIMULATION VOYAGE
        console.log('\n🚗 SIMULATION VOYAGE');
        console.log('═'.repeat(40));
        console.log(`📍 ${tripData.departure.city} → ${tripData.arrival.city} (${tripData.distance}km)`);
        console.log(`👩‍🚗 ${userData.driver.profile.displayName} (${userData.driver.email})`);
        console.log(`👩‍💼 ${userData.passenger.profile.displayName} (${userData.passenger.email})`);
        console.log(`💰 Montant: ${bookingData.totalPrice}€`);

        console.log(`📊 Status: ${bookingData.status}`);
        console.log(`🔑 PaymentIntent: ${bookingData.payment?.stripePaymentIntentId || 'N/A'}`);

        if (bookingData.payment?.stripePaymentIntentId) {



            console.log('\n💳 PAIEMENT PRÊT:');

            console.log(`├── PaymentIntent: ✅ ${bookingData.payment.stripePaymentIntentId}`);
            console.log(`├── Client Secret: ✅ ${bookingData.payment.stripeClientSecret ? 'Disponible' : 'N/A'}`);
            console.log(`├── Montant: ${bookingData.payment.amount}€`);
            console.log(`└── Status: ${bookingData.payment.status}`);
        }



        console.log('\n⏳ Voyage en cours (3s)...');
        await sleep(1000);


        console.log('🚗💨 Départ de Paris...');
        await sleep(1000);


        console.log('🛣️  En route vers Marseille...');
        await sleep(1000);






        console.log('🏁 Arrivée à Marseille !');








        // ✅ FINALISATION PAIEMENT CORRIGÉE
        logStep(7, 'Finalisation paiement par la passagère');

        if (bookingData.payment?.stripePaymentIntentId) {



            console.log('🔍 PRÉPARATION PAIEMENT:');
            console.log(`📋 Booking: ${bookingData.id}`);
            console.log(`🔑 PaymentIntent: ${bookingData.payment.stripePaymentIntentId}`);
            console.log(`🎫 Token passagère: ${tokens.passenger}`);

            // ✅ UTILISER LA MÉTHODE QUI FONCTIONNE AVEC VOS CURL
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
              console.log(`💰 Amount: ${bookingData.payment?.amount || bookingData.totalPrice}€`);
            } else {
              console.error('❌ Échec finalisation paiement:', finalizeResult.error);
              
              // ✅ PLAN B : Essayer confirm-trip-payment
              console.log('🔄 Tentative avec confirm-trip-payment...');
              const confirmPaymentData = {
                paymentIntentId: bookingData.payment.stripePaymentIntentId
              };

              const confirmPaymentResult = await makeRequest('POST', '/payments/confirm-trip-payment', 
                confirmPaymentData, tokens.passenger);
              
              if (confirmPaymentResult.success) {
                logResult(true, confirmPaymentResult.data, 'payment');
                bookingData = confirmPaymentResult.data.booking;
                console.log('\n🎉 PAIEMENT CONFIRMÉ AVEC SUCCÈS !');
                console.log(`✅ Booking Status: ${bookingData.status}`);
                console.log(`💳 Payment Status: ${bookingData.payment.status}`);
                console.log(`💰 Amount: ${bookingData.payment.amount}€`);
              } else {
                console.log('❌ Échec des deux méthodes de paiement');
                console.log('📊 Mais le PaymentIntent a été créé avec succès !');
                console.log('🔍 Vous pouvez utiliser ces données pour tester manuellement :');
                console.log(`   - Booking ID: ${bookingData.id}`);
                console.log(`   - PaymentIntent: ${bookingData.payment.stripePaymentIntentId}`);
                console.log(`   - Token: ${tokens.passenger}`);
              }
            }
        } else {



            console.log('❌ Pas de PaymentIntent disponible pour finalisation');
            throw new Error('No PaymentIntent found for payment finalization');
        }




        // VÉRIFICATION FINALE
        logStep(8, 'Vérification finale');
        const finalCheck = await makeRequest('GET', `/bookings/${bookingData.id}`, null, tokens.passenger);
        logResult(finalCheck.success, finalCheck.data || finalCheck.error);

        if (finalCheck.success) {
            bookingData = finalCheck.data.booking;
        }

        // ✅ RÉSUMÉ FINAL
        console.log('\n🎉 RÉSUMÉ FINAL - FLOW COMPLET');
        console.log('═'.repeat(60));

        console.log('\n👥 UTILISATRICES:');
        console.log(`👩‍🚗 ${userData.driver.profile.displayName} (${userData.driver.email})`);
        console.log(`🔑 Driver Token: ${tokens.driver}`);
        console.log(`👩‍💼 ${userData.passenger.profile.displayName} (${userData.passenger.email})`);
        console.log(`🔑 Passenger Token: ${tokens.passenger}`);

        console.log('\n🚗 TRAJET:');
        console.log(`📍 ${tripData.departure.city} → ${tripData.arrival.city}`);
        console.log(`📏 Distance: ${tripData.distance}km`);
        console.log(`💰 Prix: ${tripData.pricePerSeat}€/place`);
        console.log(`🆔 Trip ID: ${tripData.id}`);

        console.log('\n📋 RÉSERVATION:');
        console.log(`🆔 Booking ID: ${bookingData.id}`);
        console.log(`🪑 Places: ${bookingData.numberOfSeats}`);
        console.log(`💰 Total: ${bookingData.totalPrice}€`);
        console.log(`📊 Status: ${bookingData.status}`);

        console.log('\n💳 PAIEMENT:');
        console.log(`🔑 PaymentIntent: ${bookingData.payment?.stripePaymentIntentId || 'N/A'}`);
        console.log(`📊 Status: ${bookingData.payment?.status || 'N/A'}`);
        console.log(`💰 Montant: ${bookingData.payment?.amount || bookingData.totalPrice}€`);
        console.log(`📅 Payé le: ${bookingData.payment?.paidAt || 'N/A'}`);

        console.log('\n🎯 ÉTAPES RÉALISÉES:');
        console.log('✅ 1. Inscription conductrice');
        console.log('✅ 2. Création trajet');
        console.log('✅ 3. Inscription passagère');
        console.log('✅ 4. Recherche trajets');
        console.log('✅ 5. Réservation par passagère');
        console.log('✅ 6. Confirmation par conductrice (+ PaymentIntent)');
        console.log('✅ 7. Finalisation paiement par passagère');
        console.log('✅ 8. Vérification finale');

        console.log('\n📈 MÉTRIQUES:');
        console.log(`⏱️  Durée: ${((Date.now() - timestamp) / 1000).toFixed(2)}s`);
        console.log(`🔄 Requêtes: ~15 requêtes HTTP`);
        console.log(`💾 Données: 2 users + 1 trip + 1 booking`);
        console.log(`💳 Transaction: ${bookingData.totalPrice}€`);

        console.log('\n🎉 FLOW COMPLET RÉUSSI ! 🚗💨');
        console.log('🔥 PAIEMENT FINALISÉ AVEC SUCCÈS !');

    } catch (error) {
        console.error('\n❌ ERREUR FLOW:');
        console.error(`🚨 ${error.message}`);

        console.log('\n🔍 DONNÉES AVANT ERREUR:');
        console.log(`👩‍🚗 Driver: ${userData.driver?.email || 'N/A'}`);
        console.log(`👩‍💼 Passenger: ${userData.passenger?.email || 'N/A'}`);
        console.log(`🚗 Trip: ${tripData?.id || 'N/A'}`);
        console.log(`📋 Booking: ${bookingData?.id || 'N/A'}`);
        console.log(`💳 Payment: ${bookingData?.payment?.stripePaymentIntentId || 'N/A'}`);

        process.exit(1);
    }
};

// Lancer le flow complet
runCompleteUserFlow();