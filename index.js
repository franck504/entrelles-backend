const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/database');

const app = express();

// ✅ AJOUTER après connectDB():
const { startPayoutScheduler } = require('./utils/payoutScheduler');

// Connexion à la base de données
connectDB();

// ✅ DÉMARRER LE SCHEDULER
if (process.env.NODE_ENV !== 'test') {
  startPayoutScheduler();
}

// Middleware de sécurité
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ✅ NOUVEAU : Middleware spécial pour webhooks (avant body parsing)
app.use('/api/webhooks', require('./routes/webhooks'));

// Body parsing middleware (après webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes de base
app.get('/', (req, res) => {
  res.json({
    message: '🚗 Entrelles API - Covoiturage féminin 😁😁😁😁😁😁',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    // ✅ NOUVEAU : Infos paiement
    features: {
      payments: 'enabled',
      stripe: 'configured',
      webhooks: 'active'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    // ✅ NOUVEAU : Vérification Stripe
    stripe: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
});

// Vérifiez que cette ligne existe avec vos autres routes
app.use('/api/kyc', require('./routes/kyc'));

// Ajoutez avec vos autres routes (après les routes existantes)
app.use('/api/users', require('./routes/users'));

// Routes API existantes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));

// Test database route
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
      message: 'Database connection test',
      status: states[dbState],
      database: mongoose.connection.name,
      host: mongoose.connection.host
    });
  } catch (error) {
    res.status(500).json({
      message: 'Database test failed',
      error: error.message
    });
  }
});

// ✅ NOUVEAU : Test Stripe
app.get('/test-stripe', async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Test simple : créer un PaymentIntent de test
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // 10€
      currency: 'eur',
      metadata: { test: 'true' }
    });

    res.json({
      message: 'Stripe connection test',
      status: 'OK',
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Stripe test failed',
      error: error.message
    });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3000;

// Pour Vercel, on exporte l'app
if (process.env.NODE_ENV === 'production') {
  module.exports = app;
} else {
  // Pour le développement local
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🔗 Webhook: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Configured' : '❌ Not configured'}`);
  });
}