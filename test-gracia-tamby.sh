#!/bin/bash
# test-gracia-tamby.sh - Test complet Gracia (Conductrice) & Tamby (Passagère)

BASE_URL="https://entrelles-backend.vercel.app"
PRICE_ID="price_1Siw47JN9J8u3xFmmDBUOLIJ"

echo "🌟 TEST FLOW : GRACIA & TAMBY"
echo "=============================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === UTILISATRICES ===
G_EMAIL="gracia@entrelles.com"
G_PASS="Entrelles123!"
G_NAME="Gracia Michelle"

T_EMAIL="tamby@entrelles.com"
T_PASS="Entrelles123!"
T_NAME="Tamby Niaina"

# === 1. INSCRIPTION GRACIA (Conductrice) ===
echo -e "\n${BLUE}--- ÉTAPE 1 : Inscription Gracia (Conductrice) ---${NC}"
g_reg=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$G_EMAIL\",
    \"password\": \"$G_PASS\",
    \"displayName\": \"$G_NAME\",
    \"firstName\": \"Gracia\",
    \"lastName\": \"Michelle\",
    \"gender\": \"femme\",
    \"phone\": \"+33600000001\"
  }")
G_TOKEN=$(echo $g_reg | jq -r '.token')

if [ "$G_TOKEN" == "null" ] || [ -z "$G_TOKEN" ]; then
  echo -e "${RED}❌ Inscription Gracia échouée (elle existe peut-être déjà)${NC}"
  # Tentative login si existe déjà
  g_login=$(curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$G_EMAIL\",\"password\":\"$G_PASS\"}")
  G_TOKEN=$(echo $g_login | jq -r '.token')
  if [ "$G_TOKEN" == "null" ]; then echo "Login failed"; exit 1; fi
  echo -e "${GREEN}✅ Gracia connectée${NC}"
else
  echo -e "${GREEN}✅ Gracia inscrite${NC}"
fi

# === 2. ABONNEMENT & KYC GRACIA ===
echo -e "\n${YELLOW}🛠️  Vérification statut Gracia...${NC}"
g_sub=$(curl -s -X GET $BASE_URL/api/payments/subscription-status -H "Authorization: Bearer $G_TOKEN")
G_PLAN=$(echo $g_sub | jq -r '.subscription.plan')

if [ "$G_PLAN" != "premium" ]; then
  echo -e "${YELLOW}💳 Création checkout abonnement pour Gracia...${NC}"
  g_checkout=$(curl -s -X POST $BASE_URL/api/payments/create-checkout -H "Content-Type: application/json" -H "Authorization: Bearer $G_TOKEN" -d "{\"priceId\":\"$PRICE_ID\"}")
  echo -e "${BLUE}Lien paiement Gracia :${NC} $(echo $g_checkout | jq -r '.url')"
  echo -e "${YELLOW}Une fois payé, appuyez sur ENTRÉE...${NC}"; read
fi

echo -e "${YELLOW}🆔 Vérification KYC Gracia...${NC}"
g_kyc=$(curl -s -X GET $BASE_URL/api/kyc/status -H "Authorization: Bearer $G_TOKEN")
G_KYC_STATUS=$(echo $g_kyc | jq -r '.kyc.status')

if [ "$G_KYC_STATUS" != "verified" ]; then
  echo -e "${YELLOW}🛡️ Création lien KYC pour Gracia...${NC}"
  # Note: on utilise /start qui crée le compte ET renvoie le lien d'onboarding
  g_kyc_link=$(curl -s -X POST $BASE_URL/api/kyc/start -H "Authorization: Bearer $G_TOKEN")
  echo -e "${BLUE}Lien KYC Gracia :${NC} $(echo $g_kyc_link | jq -r '.onboarding.url')"
  echo -e "${YELLOW}Une fois le KYC terminé (Test Mode), appuyez sur ENTRÉE...${NC}"; read
fi

# === 3. CRÉATION TRAJET TARBES -> MARSEILLE ===
echo -e "\n${BLUE}--- ÉTAPE 2 : Création Trajet (Gracia) ---${NC}"
trip_res=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $G_TOKEN" \
  -d '{
    "departure": {"city": "Tarbes", "address": "Gare de Tarbes", "coordinates": {"lat": 43.2329, "lng": 0.0727}},
    "arrival": {"city": "Marseille", "address": "Marseille Saint-Charles", "coordinates": {"lat": 43.2965, "lng": 5.3698}},
    "departureDateTime": "2026-01-23T08:00:00Z",
    "totalSeats": 6,
    "availableSeats": 6,
    "distance": 550,
    "vehicleInfo": {"make": "Peugeot", "model": "5008", "color": "Gris", "licensePlate": "ENT-2026-MT"},
    "preferences": {"allowSmoking": false, "allowPets": true, "allowFood": false, "musicPreference": "medium", "chatLevel": "normal"},
    "description": "Trajet Tarbes-Marseille, grand coffre disponible."
  }')

TRIP_ID=$(echo $trip_res | jq -r '.trip.id // .trip._id')
if [ "$TRIP_ID" == "null" ] || [ -z "$TRIP_ID" ]; then 
  echo -e "${RED}❌ Échec création trajet${NC}"
  echo "$trip_res" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Trajet créé : $TRIP_ID${NC}"

# === 4. INSCRIPTION TAMBY (Passagère) ===
echo -e "\n${BLUE}--- ÉTAPE 3 : Inscription Tamby (Passagère) ---${NC}"
t_reg=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$T_EMAIL\",
    \"password\": \"$T_PASS\",
    \"displayName\": \"$T_NAME\",
    \"firstName\": \"Tamby\",
    \"lastName\": \"Niaina\",
    \"gender\": \"femme\",
    \"phone\": \"+33600000002\"
  }")
T_TOKEN=$(echo $t_reg | jq -r '.token')

if [ "$T_TOKEN" == "null" ] || [ -z "$T_TOKEN" ]; then
  t_login=$(curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$T_EMAIL\",\"password\":\"$T_PASS\"}")
  T_TOKEN=$(echo $t_login | jq -r '.token')
  echo -e "${GREEN}✅ Tamby connectée${NC}"
else
  echo -e "${GREEN}✅ Tamby inscrite${NC}"
fi

# Abonnement Tamby
t_sub=$(curl -s -X GET $BASE_URL/api/payments/subscription-status -H "Authorization: Bearer $T_TOKEN")
if [ "$(echo $t_sub | jq -r '.subscription.plan')" != "premium" ]; then
  echo -e "${YELLOW}💳 Création checkout abonnement pour Tamby...${NC}"
  t_checkout=$(curl -s -X POST $BASE_URL/api/payments/create-checkout -H "Content-Type: application/json" -H "Authorization: Bearer $T_TOKEN" -d "{\"priceId\":\"$PRICE_ID\"}")
  echo -e "${BLUE}Lien paiement Tamby :${NC} $(echo $t_checkout | jq -r '.url')"
  echo -e "${YELLOW}Une fois payé, appuyez sur ENTRÉE...${NC}"; read
fi

# === 5. RÉSERVATION (Tamby) ===
echo -e "\n${BLUE}--- ÉTAPE 4 : Réservation (Tamby) ---${NC}"
echo -e "${YELLOW}🎫 Réservation de 1 place...${NC}"
booking_res=$(curl -s -X POST $BASE_URL/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T_TOKEN" \
  -d "{\"tripId\": \"$TRIP_ID\", \"numberOfSeats\": 1, \"message\": \"Bonjour Gracia ! Je réserve une place.\"}")

BOOKING_ID=$(echo $booking_res | jq -r '.booking.id // .booking._id')
if [ "$BOOKING_ID" == "null" ] || [ -z "$BOOKING_ID" ]; then 
  echo -e "${RED}❌ Échec réservation${NC}"
  echo "$booking_res" | jq .
  exit 1 
fi
echo -e "${GREEN}✅ Réservation créée : $BOOKING_ID${NC}"

# === 6. CONFIRMATION (Gracia) ===
echo -e "\n${BLUE}--- ÉTAPE 5 : Confirmation (Gracia) ---${NC}"
echo -e "${YELLOW}📢 Gracia confirme la demande...${NC}"
confirm_res=$(curl -s -X PUT "$BASE_URL/api/bookings/$BOOKING_ID/confirm" -H "Authorization: Bearer $G_TOKEN")
if [ "$(echo $confirm_res | jq -r '.success')" == "true" ]; then
  echo -e "${GREEN}✅ Réservation confirmée !${NC}"
else
  echo -e "${RED}❌ Échec confirmation${NC}"; exit 1
fi

# === 7. PAIEMENT FINAL (Tamby) ===
echo -e "\n${BLUE}--- ÉTAPE 6 : Paiement Final (Tamby) ---${NC}"
payment_res=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T_TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

PAY_URL=$(echo $payment_res | jq -r '.url')
if [ "$PAY_URL" != "null" ]; then
  echo -e "${GREEN}✅ Session de paiement créée !${NC}"
  echo -e "\n${BLUE}🔗 PAYER ICI :${NC} $PAY_URL"
else
  echo -e "${RED}❌ Échec session paiement${NC}"; echo "$payment_res" | jq; exit 1
fi

echo -e "\n=============================================="
echo -e "${GREEN}🎉 TEST FLOW GRACIA & TAMBY PRÊT !${NC}"
echo "=============================================="
