const mongoose = require('mongoose');
require('dotenv').config();

async function checkEnumValues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('./src/models/User');
    const schema = User.schema;
    
    console.log('🔍 Valeurs enum autorisées:');
    
    // Vérifier musicPreference
    const musicPrefPath = schema.path('preferences.musicPreference');
    console.log('musicPreference:', musicPrefPath.enumValues);
    
    // Vérifier chatLevel
    const chatLevelPath = schema.path('preferences.chatLevel');
    console.log('chatLevel:', chatLevelPath.enumValues);
    
    // Vérifier gender
    const genderPath = schema.path('profile.gender');
    console.log('gender:', genderPath.enumValues);
    
    mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkEnumValues();