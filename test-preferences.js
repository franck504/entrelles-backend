const axios = require('axios');

async function testPreferences() {
  try {
    const BASE_URL = 'http://localhost:3000/api';
    
    // Créer un utilisateur
    const user = await axios.post(`${BASE_URL}/auth/register`, {
      email: `test${Date.now()}@test.com`,
      password: 'Password123',
      displayName: 'Test User',
      gender: 'femme'
    });

    console.log('✅ Utilisateur créé');

    // Tester toutes les valeurs enum
    const testCases = [
      {
        name: 'musicPreference: none',
        data: { preferences: { musicPreference: 'none' } }
      },
      {
        name: 'musicPreference: low',
        data: { preferences: { musicPreference: 'low' } }
      },
      {
        name: 'musicPreference: medium',
        data: { preferences: { musicPreference: 'medium' } }
      },
      {
        name: 'musicPreference: high',
        data: { preferences: { musicPreference: 'high' } }
      },
      {
        name: 'chatLevel: none',
        data: { preferences: { chatLevel: 'none' } }
      },
      {
        name: 'chatLevel: low',
        data: { preferences: { chatLevel: 'low' } }
      },
      {
        name: 'chatLevel: medium',
        data: { preferences: { chatLevel: 'medium' } }
      },
      {
        name: 'chatLevel: high',
        data: { preferences: { chatLevel: 'high' } }
      },
      {
        name: 'Combinaison complète',
        data: {
          bio: 'Test bio mise à jour',
          preferences: {
            allowSmoking: false,
            allowPets: true,
            allowFood: true,
            musicPreference: 'high',
            chatLevel: 'high',
            maxDetour: 20,
            autoAcceptBookings: false
          }
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`🔍 Test: ${testCase.name}`);
        
        const result = await axios.put(`${BASE_URL}/auth/update-profile`, testCase.data, {
          headers: { Authorization: `Bearer ${user.data.token}` }
        });
        
        console.log(`✅ ${testCase.name} - SUCCESS`);
        
      } catch (error) {
        console.log(`❌ ${testCase.name} - FAILED:`, error.response?.data?.message);
      }
    }

    // Vérifier le profil final
    const finalProfile = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${user.data.token}` }
    });

    console.log('📊 Profil final:');
    console.log('Bio:', finalProfile.data.user.profile.bio);
    console.log('Préférences:', finalProfile.data.user.preferences);

  } catch (error) {
    console.error('❌ Erreur test préférences:', error.response?.data || error.message);
  }
}

testPreferences();