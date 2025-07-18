# API Documentation: Create Trip

## Endpoint
```
POST /api/trips
```

## Description
Crée un nouveau trajet de covoiturage. Nécessite une authentification avec un compte conducteur ayant complété la vérification KYC.

## Authentication
- **Type**: Bearer Token
- **Required Role**: Conducteur avec KYC vérifié

## Headers
```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

## Request Body (JSON)

### Required Fields
```json
{
  "departure": {
    "city": "Paris",
    "address": "Place de la Concorde",
    "postalCode": "75008",
    "coordinates": {
      "lat": 48.865633,
      "lng": 2.321236
    }
  },
  "arrival": {
    "city": "Lyon",
    "address": "Place Bellecour",
    "postalCode": "69002",
    "coordinates": {
      "lat": 45.757814,
      "lng": 4.832011
    }
  },
  "departureDateTime": "2025-07-25T14:30:00.000Z",
  "totalSeats": 4,
  "distance": 465
}
```

### Optional Fields
```json
{
  "car": {
    "model": "Peugeot 208",
    "color": "Bleu",
    "licensePlate": "AB-123-CD",
    "fuelType": "Diesel"
  },
  "preferences": {
    "allowSmoking": false,
    "allowPets": true,
    "allowFood": true,
    "musicPreference": "medium",
    "chatLevel": "normal",
    "maxDetour": 5
  },
  "description": "Trajet direct autoroute, coffre de toit disponible",
  "notes": "Je pars à l'heure, pas de valises énormes merci"
}
```

## Responses

### Success (201 Created)
```json
{
  "success": true,
  "message": "Trajet créé avec succès",
  "trip": {
    "_id": "60d5ecb4b2929e002a4c8e9f",
    "driver": "60d5ecb4b2929e002a4c8e9a",
    "departure": {
      "city": "Paris",
      "address": "Place de la Concorde",
      "postalCode": "75008",
      "coordinates": {
        "lat": 48.865633,
        "lng": 2.321236
      }
    },
    "arrival": {
      "city": "Lyon",
      "address": "Place Bellecour",
      "postalCode": "69002",
      "coordinates": {
        "lat": 45.757814,
        "lng": 4.832011
      }
    },
    "departureDateTime": "2025-07-25T14:30:00.000Z",
    "estimatedDuration": 275,
    "estimatedArrivalDateTime": "2025-07-25T19:05:00.000Z",
    "totalSeats": 4,
    "availableSeats": 4,
    "pricePerSeat": 256,
    "status": "active",
    "createdAt": "2025-07-18T19:13:39.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields
```json
{
  "success": false,
  "message": "La distance est obligatoire pour créer un trajet",
  "field": "distance"
}
```

#### 403 Forbidden - KYC Not Verified
```json
{
  "success": false,
  "message": "Vérification KYC requise pour créer des trajets payants",
  "error": "KYC_VERIFICATION_REQUIRED",
  "kyc": {
    "status": "pending_verification",
    "message": "Votre compte doit être vérifié",
    "nextAction": "complete_kyc",
    "connectAccountId": "acct_123456789"
  },
  "action": {
    "type": "kyc_required",
    "title": "Vérification requise",
    "description": "Vous devez compléter votre vérification d'identité pour créer des trajets payants",
    "buttonText": "Compléter la vérification",
    "redirectTo": "/kyc/start"
  }
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "message": "Non autorisé - Token invalide ou expiré"
}
```

## Technical Details

### Price Calculation
- **Formula**: `price = distance_in_km × 0.55€`
- **Rounding**: Always rounded up to the nearest euro
- **Example**: 42.3 km → 42.3 × 0.55 = 23.27€ → 24€

### Trip Statuses
- `active`: Available for booking
- `full`: No more seats available
- `completed`: Trip completed
- `cancelled`: Trip cancelled

### Frontend Implementation Notes
1. **Date Handling**: Use ISO 8601 format
2. **GPS Coordinates**: Always provide both latitude and longitude
3. **Caching**: Implement caching for better performance
4. **Pagination**: Not applicable for creation
5. **KYC Status**: Verify KYC status before showing the form

### Example Implementation with fetch
```javascript
const createTrip = async (tripData) => {
  const response = await fetch('/api/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(tripData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

## Version
1.0.0

## Last Updated
2025-07-18
