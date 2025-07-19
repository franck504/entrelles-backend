# API de Requêtes pour les Trajets et Réservations

## Statuts des Trajets (Trip)

### Valeurs possibles pour `status` :
- `active` : Trajet actif et acceptant des réservations (valeur par défaut)
- `completed` : Trajet terminé
- `cancelled` : Trajet annulé
- `full` : Plus de places disponibles

## Statuts des Réservations (Booking)

### Valeurs possibles pour `status` :
- `pending` : En attente de confirmation (valeur par défaut)
- `confirmed` : Réservation confirmée par le conducteur
- `cancelled` : Réservation annulée
- `completed` : Trajet effectué
- `paid` : Paiement effectué

### Statuts de Paiement (`payment.status`) :
- `pending` : En attente de paiement
- `processing` : Paiement en cours de traitement
- `succeeded` : Paiement réussi
- `failed` : Échec du paiement
- `canceled` : Paiement annulé
- `refunded` : Paiement remboursé
- `paid` : Paiement effectué

## Requêtes de Récupération

### 1. Récupérer tous les trajets (public)
```bash
curl -X GET 'https://entrelles-backend.vercel.app/api/trips' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```

### 2. Récupérer un trajet spécifique
```bash
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/TRIP_ID' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```

### 3. Rechercher des trajets avec filtres
```bash
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/search?from=Paris&to=Lyon&date=2025-07-25&seats=1&status=active' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```
Paramètres disponibles :
- `from` : Ville de départ
- `to` : Ville d'arrivée
- `date` : Date au format YYYY-MM-DD
- `seats` : Nombre de places requises (min: 1, max: 8)
- `status` : Statut du trajet (optionnel)

### 4. Mes trajets (conducteur ou passager)
```bash
# Tous mes trajets
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/my-trips' \
  -H 'Authorization: Bearer VOTRE_TOKEN'

# Filtrer par type (driver/passenger)
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/my-trips?type=driver' \
  -H 'Authorization: Bearer VOTRE_TOKEN'

# Filtrer par statut
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/my-trips?status=upcoming' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```

### 5. Statistiques des trajets
```bash
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/my-stats' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```

### 6. Récupérer les réservations
```bash
# Toutes mes réservations
curl -X GET 'https://entrelles-backend.vercel.app/api/bookings' \
  -H 'Authorization: Bearer VOTRE_TOKEN'

# Filtrer par statut
curl -X GET 'https://entrelles-backend.vercel.app/api/bookings?status=confirmed' \
  -H 'Authorization: Bearer VOTRE_TOKEN'

# Réservations pour un trajet spécifique (conducteur uniquement)
curl -X GET 'https://entrelles-backend.vercel.app/api/trips/TRIP_ID/bookings' \
  -H 'Authorization: Bearer VOTRE_TOKEN'
```

## Exemple de Réponse pour un Trajet
```json
{
  "_id": "60d5ecb4b2929e002a4c8e9f",
  "departure": {
    "city": "Paris",
    "address": "Gare de Lyon, 75012 Paris",
    "coordinates": { "lat": 48.8449, "lng": 2.3733 },
    "postalCode": "75012"
  },
  "arrival": {
    "city": "Lyon",
    "address": "Gare Part-Dieu, 69003 Lyon",
    "coordinates": { "lat": 45.7606, "lng": 4.8604 },
    "postalCode": "69003"
  },
  "departureDateTime": "2025-07-25T14:30:00.000Z",
  "estimatedArrivalDateTime": "2025-07-25T19:40:00.000Z",
  "availableSeats": 2,
  "totalSeats": 3,
  "pricePerSeat": 256,
  "distance": 465,
  "status": "active",
  "driver": {
    "profile": {
      "displayName": "Natacha",
      "avatar": ""
    },
    "stats": {
      "rating": 4.8,
      "ratingsCount": 24
    }
  }
}
```

## Exemple de Réponse pour une Réservation
```json
{
  "_id": "60d5ecb4b2929e002a4c8e9f",
  "trip": "TRIP_ID",
  "passenger": {
    "profile": {
      "displayName": "Jean Dupont",
      "avatar": ""
    }
  },
  "numberOfSeats": 2,
  "totalPrice": 512,
  "status": "confirmed",
  "payment": {
    "status": "succeeded",
    "amount": 512,
    "currency": "eur",
    "commission": {
      "appFee": 102.4,
      "driverAmount": 409.6,
      "processingFee": 40.1,
      "totalAmount": 512
    },
    "paidAt": "2025-07-18T20:19:44.800Z"
  },
  "requestedAt": "2025-07-18T20:19:44.800Z",
  "confirmedAt": "2025-07-18T20:20:15.200Z"
}
```

## Codes d'Erreur Courants
- `400` : Requête invalide (paramètres manquants ou invalides)
- `401` : Non autorisé (token manquant ou invalide)
- `403` : Accès refusé (droits insuffisants)
- `404` : Ressource non trouvée
- `500` : Erreur serveur
