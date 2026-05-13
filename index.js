const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/database');
const { startPayoutScheduler } = require('./utils/payoutScheduler');

const app = express();

// Connexion à la base de données
connectDB();

// Démarrage du planificateur de paiements (hors environnement de test)
if (process.env.NODE_ENV !== 'test') {
  startPayoutScheduler();
}

// Middleware de sécurité
app.use(helmet());

// Configuration CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Journalisation en mode développement
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Middleware spécifique pour les webhooks Stripe (doit être avant le parsing JSON global)
app.use('/api/webhooks', require('./routes/webhooks'));

// Middlewares de parsing pour les requêtes JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Point d'entrée de l'API
app.get('/', (req, res) => {
  res.json({
    message: 'Entrelles API - Service de covoiturage féminin',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      payments: 'enabled',
      stripe: 'configured',
      webhooks: 'active'
    }
  });
});

// Endpoint de santé du système
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    stripe: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
});

// Routes de l'API
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/maps', require('./routes/maps'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));

// Route de test pour la connexion à la base de données
app.get('/test-db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;

    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    res.json({
      message: 'Test de connexion à la base de données',
      status: states[dbState],
      database: mongoose.connection.name,
      host: mongoose.connection.host
    });
  } catch (error) {
    res.status(500).json({
      message: 'Échec du test de connexion',
      error: error.message
    });
  }
});

// Middleware global de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Une erreur interne est survenue',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Gestion des routes non trouvées (404)
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3000;

// Exportation pour Vercel (Production) ou écoute locale
if (process.env.NODE_ENV === 'production') {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Environnement : ${process.env.NODE_ENV || 'development'}`);
    console.log(`URL de l'API : http://localhost:${PORT}`);
    console.log(`Stripe : ${process.env.STRIPE_SECRET_KEY ? 'Configuré' : 'Non configuré'}`);
  });
}