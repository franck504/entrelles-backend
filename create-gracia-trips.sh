#!/bin/bash
# create-gracia-trips.sh - Créer 3 trajets avec Gracia (conductrice)

BASE_URL="https://entrelles-backend.vercel.app"

echo "🚗 Création de 3 Trajets - Gracia (Conductrice)"
echo "================================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === CONFIGURATION GRACIA ===
EMAIL="gracia@entrelles.com"
PASSWORD="Entrelles123!"

echo -e "\n${YELLOW}📧 Conductrice: $EMAIL${NC}"

# === 1. LOGIN ===
echo -e "\n${YELLOW}1️⃣  Connexion Gracia${NC}"
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
  exit 1
else
  echo -e "${GREEN}✅ Connectée${NC}"
fi

# === 2. TRAJET 1: PARIS → LYON ===
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}2️⃣  Trajet 1: Paris → Lyon${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

trip1=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "departure": {
      "city": "Metz",
      "address": "Gare de Lyon, Metz",
      "coordinates": { "lat": 48.8448, "lng": 2.3736 }
    },
    "arrival": {
      "city": "Lyon",
      "address": "Gare Part-Dieu, Lyon",
      "coordinates": { "lat": 45.7603, "lng": 4.8598 }
    },
    "departureDateTime": "2025-12-30T14:00:00Z",
    "totalSeats": 4,
    "availableSeats": 3,
    "distance": 465,
    "vehicleInfo": {
      "make": "Peugeot",
      "model": "3008",
      "color": "Gris",
      "licensePlate": "AB-123-CD"
    },
    "preferences": {
      "allowSmoking": false,
      "allowPets": true,
      "allowFood": true,
      "musicPreference": "medium",
      "chatLevel": "normal"
    },
    "description": "Trajet direct Paris-Lyon. Départ après-midi, arrivée en soirée. Possibilité de faire un arrêt."
  }')

TRIP1_ID=$(echo $trip1 | jq -r '.trip.id')
if [ "$TRIP1_ID" != "null" ] && [ -n "$TRIP1_ID" ]; then
  PRICE1=$(echo $trip1 | jq -r '.trip.pricePerSeat')
  echo -e "${GREEN}✅ Trajet 1 créé !${NC}"
  echo "   📍 Paris → Lyon"
  echo "   💰 ${PRICE1}€/place"
  echo "   🆔 $TRIP1_ID"
else
  echo -e "${RED}❌ Échec trajet 1${NC}"
  echo "$trip1" | jq
fi

# === 3. TRAJET 2: MARSEILLE → NICE ===
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}3️⃣  Trajet 2: Marseille → Nice${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

trip2=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "departure": {
      "city": "Paris",
      "address": "Tour Eiffel, Paris",
      "coordinates": { "lat": 43.3026, "lng": 5.3808 }
    },
    "arrival": {
      "city": "Nice",
      "address": "Promenade des Anglais, Nice",
      "coordinates": { "lat": 43.7102, "lng": 7.2620 }
    },
    "departureDateTime": "2025-12-31T09:00:00Z",
    "totalSeats": 3,
    "availableSeats": 2,
    "distance": 205,
    "vehicleInfo": {
      "make": "Renault",
      "model": "Clio",
      "color": "Rouge",
      "licensePlate": "EF-456-GH"
    },
    "preferences": {
      "allowSmoking": false,
      "allowPets": false,
      "allowFood": true,
      "musicPreference": "low",
      "chatLevel": "quiet"
    },
    "description": "Trajet côte d'\''Azur. Départ matinal pour arriver à midi. Ambiance calme."
  }')

TRIP2_ID=$(echo $trip2 | jq -r '.trip.id')
if [ "$TRIP2_ID" != "null" ] && [ -n "$TRIP2_ID" ]; then
  PRICE2=$(echo $trip2 | jq -r '.trip.pricePerSeat')
  echo -e "${GREEN}✅ Trajet 2 créé !${NC}"
  echo "   📍 Marseille → Nice"
  echo "   💰 ${PRICE2}€/place"
  echo "   🆔 $TRIP2_ID"
else
  echo -e "${RED}❌ Échec trajet 2${NC}"
  echo "$trip2" | jq
fi

# === 4. TRAJET 3: TOULOUSE → BORDEAUX ===
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}4️⃣  Trajet 3: Toulouse → Bordeaux${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

trip3=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "departure": {
      "city": "Tarbes",
      "address": "Place du Capitole, Tarbes",
      "coordinates": { "lat": 43.6045, "lng": 1.4440 }
    },
    "arrival": {
      "city": "Bordeaux",
      "address": "Place de la Bourse, Bordeaux",
      "coordinates": { "lat": 44.8378, "lng": -0.5792 }
    },
    "departureDateTime": "2026-01-02T16:00:00Z",
    "totalSeats": 4,
    "availableSeats": 4,
    "distance": 245,
    "vehicleInfo": {
      "make": "Citroën",
      "model": "C4",
      "color": "Blanc",
      "licensePlate": "IJ-789-KL"
    },
    "preferences": {
      "allowSmoking": false,
      "allowPets": true,
      "allowFood": true,
      "musicPreference": "high",
      "chatLevel": "talkative"
    },
    "description": "Trajet Toulouse-Bordeaux en fin d'\''après-midi. Ambiance conviviale, musique au programme !"
  }')

TRIP3_ID=$(echo $trip3 | jq -r '.trip.id')
if [ "$TRIP3_ID" != "null" ] && [ -n "$TRIP3_ID" ]; then
  PRICE3=$(echo $trip3 | jq -r '.trip.pricePerSeat')
  echo -e "${GREEN}✅ Trajet 3 créé !${NC}"
  echo "   📍 Toulouse → Bordeaux"
  echo "   💰 ${PRICE3}€/place"
  echo "   🆔 $TRIP3_ID"
else
  echo -e "${RED}❌ Échec trajet 3${NC}"
  echo "$trip3" | jq
fi

# === 5. RÉCAPITULATIF ===
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Création Terminée !${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "\n📊 ${YELLOW}Trajets créés par Gracia:${NC}"
[ -n "$TRIP1_ID" ] && echo "   1. Paris → Lyon (${PRICE1}€) - $TRIP1_ID"
[ -n "$TRIP2_ID" ] && echo "   2. Marseille → Nice (${PRICE2}€) - $TRIP2_ID"
[ -n "$TRIP3_ID" ] && echo "   3. Toulouse → Bordeaux (${PRICE3}€) - $TRIP3_ID"

echo ""
