# Entrelles Backend

Infrastructure backend pour Entrelles, une plateforme de covoiturage 100% féminine.

## Aperçu du Projet

Entrelles est une solution de mobilité solidaire conçue par et pour les femmes. Ce backend gère l'authentification sécurisée, la gestion des trajets, les réservations en temps réel et l'intégration des paiements via Stripe.

## Architecture

Le projet suit une architecture modulaire basée sur Node.js et Express :

- **`models/`** : Schémas Mongoose pour les utilisateurs, trajets, réservations et notifications.
- **`controllers/`** : Logique métier et orchestration des services.
- **`routes/`** : Définition des points d'entrée de l'API REST.
- **`middleware/`** : Authentification JWT, gestion des erreurs et validation KYC.
- **`config/`** : Configuration de la base de données et des services tiers.

## Fonctionnalités Clés

- **Authentification Sécurisée** : Inscription, connexion, et gestion de session via JWT.
- **Gestion des Trajets** : Création, recherche avancée par ville, date et préférences.
- **Système de Réservation** : Demandes de places, confirmation par la conductrice et blocage des places.
- **Paiements Stripe** : Intégration de Stripe Checkout pour les réservations et les abonnements Premium.
- **Vérification KYC** : Processus de vérification d'identité via Stripe Connect pour les conductrices.
- **IA Conversationnelle** : Assistance intégrée via l'API Gemini.

## Installation et Utilisation

### Prérequis

- Node.js (v14+)
- MongoDB (Local ou Atlas)
- Compte Stripe (pour les paiements et le KYC)

### Configuration

Créez un fichier `.env` à la racine :

```env
PORT=5000
MONGODB_URI=votre_uri_mongodb
JWT_SECRET=votre_secret_jwt
STRIPE_SECRET_KEY=votre_cle_stripe
STRIPE_WEBHOOK_SECRET=votre_secret_webhook
GEMINI_API_KEY=votre_cle_gemini
CLOUDINARY_URL=votre_url_cloudinary
```

### Démarrage

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Démarrage en production
npm start
```

## Déploiement

Le projet est configuré pour être déployé sur **Vercel** via des fonctions Serverless.

## Licence

Tous droits réservés - Entrelles 2026.
