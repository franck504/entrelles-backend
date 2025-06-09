const axios = require('axios');

async function activerAbonnementManuellement() {
  try {
    console.log('🔧 Activation manuelle de l\'abonnement...');
    
    // Données de votre dernier test
    const email = 'test-3euros-1749476063601@entrelles.com';
    const sessionId = 'cs_live_a1ZPx1QyTLKyRYm9IauPXiqwJFQeAGnJMdsm9CmR8vIpizgkBuicOLskOL';
    
    // 1. Se connecter avec l'utilisateur
    console.log('🔐 Connexion utilisateur...');
    const loginResponse = await axios.post('https://entrelles-backend.vercel.app/api/auth/login', {
      email: email,
      password: 'Test3Euros123!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Connecté !');
    
    // 2. Vérifier le statut AVANT
    console.log('📊 Statut AVANT activation...');
    const statusBefore = await axios.get('https://entrelles-backend.vercel.app/api/payments/subscription-status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Plan actuel:', statusBefore.data.data.plan);
    console.log('Actif:', statusBefore.data.data.hasActiveSubscription);
    
    // 3. Activer manuellement via simulation webhook
    console.log('🎯 Activation manuelle...');
    const activationResponse = await axios.post('https://entrelles-backend.vercel.app/api/webhooks/simulate-payment', {
      userId: loginResponse.data.user.id
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Activation réussie !');
    
    // 4. Vérifier le statut APRÈS
    console.log('📊 Statut APRÈS activation...');
    const statusAfter = await axios.get('https://entrelles-backend.vercel.app/api/payments/subscription-status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('🎉 RÉSULTAT:');
    console.log('Plan:', statusAfter.data.data.plan);
    console.log('Actif:', statusAfter.data.data.hasActiveSubscription);
    console.log('Statut:', statusAfter.data.data.status);
    
    if (statusAfter.data.data.hasActiveSubscription) {
      console.log('🎯 SUCCÈS ! Abonnement 3€ activé manuellement');
    } else {
      console.log('❌ Échec de l\'activation');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

activerAbonnementManuellement();