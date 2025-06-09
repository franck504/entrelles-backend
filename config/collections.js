// Optionnel : Pré-créer les collections
const mongoose = require('mongoose');

const initializeCollections = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Créer les collections si elles n'existent pas
    const collections = ['users', 'trajets', 'reservations', 'messages'];
    
    for (const collectionName of collections) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        await db.createCollection(collectionName);
        console.log(`✅ Collection '${collectionName}' created`);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing collections:', error);
  }
};

module.exports = initializeCollections;