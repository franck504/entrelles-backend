#!/bin/bash
# test-creer-trajet.sh - Créer un trajet avec compte existant

BASE_URL="https://entrelles-backend.vercel.app"

echo "🚗 Création Trajet - Compte Existant"
echo "===================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# === CONFIGURATION ===
# Utilisez le dernier compte créé ou mettez vos propres credentials
EMAIL="${1:-conductrice.1766895502@entrelles.com}"
PASSWORD="${2:-Cond123!}"

echo -e "\n${YELLOW}📧 Email: $EMAIL${NC}"

# === 1. LOGIN ===
echo -e "\n${YELLOW}1️⃣  Connexion${NC}"
login=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

TOKEN=$(echo $login | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Connexion échouée${NC}"
  echo "$login" | jq
  echo ""
  echo "💡 Usage:"
  echo "   ./test-creer-trajet.sh <email> <password>"
  echo "   ou"
  echo "   ./test-creer-trajet.sh   (utilise l'email par défaut)"
  exit 1
else
  echo -e "${GREEN}✅ Connecté${NC}"
fi

# === 2. VÉRIFIER ABONNEMENT ===
echo -e "\n${YELLOW}2️⃣  Vérification Abonnement & KYC${NC}"
sub=$(curl -s -X GET $BASE_URL/api/payments/subscription-status \
  -H "Authorization: Bearer $TOKEN")
kyc=$(curl -s -X GET $BASE_URL/api/kyc/status \
  -H "Authorization: Bearer $TOKEN")

PLAN=$(echo $sub | jq -r '.subscription.plan')
IS_ACTIVE=$(echo $sub | jq -r '.subscription.isActive')
KYC_STATUS=$(echo $kyc | jq -r '.kyc.status')

echo "   Abonnement: $PLAN ($IS_ACTIVE)"
echo "   KYC: $KYC_STATUS"

if [ "$PLAN" != "premium" ] || [ "$IS_ACTIVE" != "true" ]; then
  echo -e "${RED}❌ Abonnement Premium requis${NC}"
  echo "   Utilisez ./test-conductrice.sh d'abord"
  exit 1
fi

if [ "$KYC_STATUS" != "verified" ]; then
  echo -e "${RED}❌ KYC non vérifié${NC}"
  echo "   Utilisez ./test-conductrice.sh d'abord"
  exit 1
fi

echo -e "${GREEN}✅ Prêt à créer un trajet${NC}"

# === 3. CRÉER TRAJET ===
echo -e "\n${YELLOW}3️⃣  Création Trajet Paris → Lyon${NC}"

trip=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "departure": {
      "city": "Paris",
      "address": "Gare de Lyon, Paris",
      "coordinates": { "lat": 48.8448, "lng": 2.3736 }
    },
    "arrival": {
      "city": "Lyon",
      "address": "Gare Part-Dieu, Lyon",
      "coordinates": { "lat": 45.7603, "lng": 4.8598 }
    },
    "departureDateTime": "2026-01-25T14:00:00Z",
    "totalSeats": 3,
    "availableSeats": 3,
    "distance": 465,
    "vehicleInfo": {
      "make": "Renault",
      "model": "Clio",
      "color": "Bleu",
      "licensePlate": "AB-123-CD"
    },
    "preferences": {
      "allowSmoking": false,
      "allowPets": true,
      "allowFood": true,
      "musicPreference": "low",
      "chatLevel": "quiet"
    },
    "description": "Trajet direct Paris-Lyon, départ gare de Lyon"
  }')

TRIP_ID=$(echo $trip | jq -r '.trip.id')

if [ "$TRIP_ID" == "null" ] || [ -z "$TRIP_ID" ]; then
  echo -e "${RED}❌ Création trajet échouée${NC}"
  echo "$trip" | jq
  exit 1
else
  PRICE=$(echo $trip | jq -r '.trip.pricePerSeat')
  SEATS=$(echo $trip | jq -r '.trip.availableSeats')
  
  echo -e "${GREEN}✅ Trajet créé !${NC}"
  echo "   ID: $TRIP_ID"
  echo "   Prix par place: ${PRICE}€"
  echo "   Places disponibles: $SEATS"
fi

# === 4. VOIR MES TRAJETS ===
echo -e "\n${YELLOW}4️⃣  Mes Trajets${NC}"
my_trips=$(curl -s -X GET $BASE_URL/api/trips/my-trips \
  -H "Authorization: Bearer $TOKEN")

TRIP_COUNT=$(echo $my_trips | jq -r '.trips | length')
echo -e "${GREEN}✅ Vous avez $TRIP_COUNT trajet(s)${NC}"

echo -e "\n===================================="
echo -e "${GREEN}🎉 Test Terminé !${NC}\n"
echo "📊 Résumé:"
echo "   Email: $EMAIL"
echo "   Trajet créé: $TRIP_ID"
echo "   Prix: ${PRICE}€/place"
echo "   Total trajets: $TRIP_COUNT"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Tester la réservation: ./test-trajet-complet.sh"
echo "   2. Créer d'autres trajets: ./test-creer-trajet.sh"
