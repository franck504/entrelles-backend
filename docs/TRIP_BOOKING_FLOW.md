# Flux Utilisateur et États - Guide pour le Développement Frontend

## 1. Gestion des Trajets (Trip)

### 1.1 Prix et Places
- `pricePerSeat` : Prix unitaire par place (calculé comme 0.55€ × distance en km)
- `totalSeats` : Nombre total de places disponibles
- `availableSeats` : Nombre de places encore disponibles

### 1.2 États Possibles
- `active` : Le trajet est actif et peut être réservé (état par défaut)
- `completed` : Le trajet est terminé (date de départ dépassée)
- `cancelled` : Le trajet a été annulé par le conducteur

### 1.2 Champs Importants
- `availableSeats` : Nombre de places disponibles (0 = complet)
- `totalSeats` : Nombre total de places
- `departureDateTime` : Date et heure de départ

### 1.3 Transitions d'État

#### Création d'un trajet
```
Événement : Création
Ancien état : (aucun)
Nouvel état : active
Action : availableSeats = totalSeats
```

#### Annulation d'un trajet
```
Événement : Annulation par le conducteur
Ancien état : active
Nouvel état : cancelled
Action : Annuler toutes les réservations associées
```

#### Fin d'un trajet
```
Événement : Date de départ dépassée
Ancien état : active
Nouvel état : completed
Action : Marquer les réservations comme terminées
```

## 2. Gestion des Réservations (Booking)

### 2.1 Calcul du Prix
- `numberOfSeats` : Nombre de places réservées
- `totalPrice` : Montant total à payer (calculé comme `trip.pricePerSeat × numberOfSeats`)
- `payment.status` : État du paiement (`pending`, `succeeded`, `refunded`, etc.)

### 2.2 États Possibles
- `pending` : En attente de confirmation (état par défaut)
- `confirmed` : Confirmée par le conducteur
- `cancelled` : Annulée par l'une des parties
- `completed` : Le trajet s'est déroulé avec succès

### 2.3 Champs Importants
- `payment.status` : État du paiement (`pending`, `succeeded`, `refunded`, etc.)
- `payment.paidAt` : Date de paiement
- `cancelledAt` : Date d'annulation
- `completedAt` : Date de fin de trajet

### 2.4 Transitions d'État

#### Création d'une réservation
```
Événement : Création
Ancien état : (aucun)
Nouvel état : pending
Action : Créer une intention de paiement
```

#### Confirmation d'une réservation
```
Événement : Confirmation par le conducteur
Ancien état : pending
Nouvel état : confirmed
Action : Décrémenter availableSeats du trajet
```

#### Annulation d'une réservation
```
Événement : Annulation
Ancien état : pending/confirmed
Nouvel état : cancelled
Action : 
  - Si payé, déclencher un remboursement
  - Si confirmed, incrémenter availableSeats
```

#### Finalisation d'une réservation
```
Événement : Fin du trajet
Ancien état : confirmed
Nouvel état : completed
Action : Déclencher l'évaluation
```

## 3. Exemple de Calcul de Prix

### 3.1 Création d'un Trajet
```javascript
// Pour un trajet de 100km
const distance = 100; // km
const pricePerKm = 0.55; // €/km
const pricePerSeat = Math.ceil(distance * pricePerKm * 100) / 100; // 55.00€

// Le prix affiché sera de 55€ par place
```

### 3.2 Création d'une Réservation
```javascript
// Si un passager réserve 2 places
const numberOfSeats = 2;
const totalPrice = pricePerSeat * numberOfSeats; // 110.00€

// Le passager paiera 110€ au total
```

## 4. Vérification des Places Disponibles

### 3.1 Logique de Vérification
```javascript
// Vérifier si un trajet peut être réservé
function canBookTrip(trip, requestedSeats) {
  return (
    trip.status === 'active' && 
    trip.availableSeats >= requestedSeats &&
    new Date(trip.departureDateTime) > new Date()
  );
}
```

### 3.2 Affichage du Statut
```javascript
function getTripStatusDisplay(trip) {
  if (trip.status === 'cancelled') return 'Annulé';
  if (trip.status === 'completed') return 'Terminé';
  if (trip.availableSeats === 0) return 'Complet';
  if (new Date(trip.departureDateTime) < new Date()) return 'Terminé';
  return 'Disponible';
}
```

## 4. Points d'Intégration Frontend

### 4.1 Affichage d'un Trajet
- Afficher le statut avec `getTripStatusDisplay()`
- Afficher les places disponibles : `${trip.availableSeats} / ${trip.totalSeats}`
- Désactiver le bouton "Réserver" si `!canBookTrip(trip, 1)`

### 4.2 Gestion des Réservations
- Afficher l'état de la réservation
- Afficher l'état du paiement
- Afficher les actions disponibles (annuler, confirmer, etc.)

## 5. Exemples de Requêtes

### 5.1 Récupérer les trajets actifs
```http
GET /api/trips?status=active&availableSeats[gt]=0
```

### 5.2 Créer une réservation
```http
POST /api/bookings
{
  "tripId": "trip_id_here",
  "numberOfSeats": 1
}
```

### 5.3 Confirmer une réservation
```http
PUT /api/bookings/booking_id/confirm
```

## 6. Gestion des Erreurs

### 6.1 Erreurs Courantes
- `400` : Requête invalide (places insuffisantes, date passée, etc.)
- `403` : Action non autorisée
- `404` : Ressource non trouvée

### 6.2 Validation des Données
Toujours valider côté frontend avant d'envoyer les requêtes :
- Nombre de places disponibles
- Statut du trajet
- Date de départ
- Permissions de l'utilisateur

## 7. Bonnes Pratiques

### 7.1 Pour le Frontend
- Toujours vérifier l'état avant d'afficher les actions
- Mettre à jour le cache après chaque action
- Afficher des messages d'erreur clairs

### 7.2 Pour les Tests
- Tester chaque transition d'état
- Tester les cas d'erreur
- Vérifier la cohérence des données après chaque action
