const mongoose = require('mongoose');

/**
 * Initialise la connexion à la base de données MongoDB
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Base de données connectée : ${conn.connection.host}`);
  } catch (error) {
    console.error('Erreur de connexion MongoDB :', error.message);
    process.exit(1);
  }
};

// Gestion des événements de cycle de vie de la connexion
mongoose.connection.on('error', (err) => {
  console.error('Erreur de connexion Mongoose :', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose déconnecté');
});

module.exports = connectDB;