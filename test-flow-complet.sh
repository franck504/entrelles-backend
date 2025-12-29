#!/bin/bash
# test-flow-complet.sh - Orchestration complète Sophie (Conductrice) & Cathia (Passagère)

BASE_URL="https://entrelles-backend.vercel.app"

echo "🚗 TEST FLOW COMPLET - ENTRELLES"
echo "================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === CRÉDENTIALS ===
SOPHIE_EMAIL="conductrice.1766895502@entrelles.com"
SOPHIE_PASS="Cond123!"
CATHIA_EMAIL="cathia@entrelles.com"
CATHIA_PASS="Pass123!"

# === 1. SOPHIE : CRÉATION DU TRAJET ===
echo -e "\n${BLUE}--- ÉTAPE 1 : Sophie (Conductrice) ---${NC}"
echo -e "${YELLOW}🔑 Connexion Sophie...${NC}"
sophie_login=$(curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$SOPHIE_EMAIL\",\"password\":\"$SOPHIE_PASS\"}")
SOPHIE_TOKEN=$(echo $sophie_login | jq -r '.token')

if [ "$SOPHIE_TOKEN" == "null" ]; then echo -e "${RED}❌ Sophie login failed${NC}"; exit 1; fi

echo -e "${YELLOW}🛣️  Création d'un nouveau trajet Paris -> Lyon...${NC}"
trip_res=$(curl -s -X POST $BASE_URL/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SOPHIE_TOKEN" \
  -d '{
    "departure": {"city": "Paris", "address": "Gare de Lyon", "coordinates": {"lat": 48.8, "lng": 2.3}},
    "arrival": {"city": "Lyon", "address": "Gare de la Part-Dieu", "coordinates": {"lat": 45.7, "lng": 4.8}},
    "departureDateTime": "2026-06-15T10:00:00Z",
    "totalSeats": 4,
    "availableSeats": 4,
    "distance": 465,
    "vehicleInfo": {"make": "Tesla", "model": "Model 3", "color": "Blanc", "licensePlate": "EL-2025-ZZ"},
    "preferences": {"allowSmoking": false, "allowPets": true, "allowFood": true, "musicPreference": "low", "chatLevel": "normal"},
    "description": "Nouveau trajet pour test flow complet"
  }')

TRIP_ID=$(echo $trip_res | jq -r '.trip.id')
if [ "$TRIP_ID" == "null" ]; then echo -e "${RED}❌ Trip creation failed${NC}"; echo "$trip_res" | jq; exit 1; fi
echo -e "${GREEN}✅ Trajet créé : $TRIP_ID${NC}"

# === 2. CATHIA : RÉSERVATION ===
echo -e "\n${BLUE}--- ÉTAPE 2 : Cathia (Passagère) ---${NC}"
echo -e "${YELLOW}🔑 Connexion Cathia...${NC}"
cathia_login=$(curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$CATHIA_EMAIL\",\"password\":\"$CATHIA_PASS\"}")
CATHIA_TOKEN=$(echo $cathia_login | jq -r '.token')

if [ "$CATHIA_TOKEN" == "null" ]; then echo -e "${RED}❌ Cathia login failed${NC}"; exit 1; fi

echo -e "${YELLOW}🎫 Réservation d'une place sur le trajet $TRIP_ID...${NC}"
booking_res=$(curl -s -X POST $BASE_URL/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CATHIA_TOKEN" \
  -d "{\"tripId\": \"$TRIP_ID\", \"numberOfSeats\": 1, \"message\": \"Je réserve pour le test complet !\"}")

BOOKING_ID=$(echo $booking_res | jq -r '.booking.id')
if [ "$BOOKING_ID" == "null" ]; then echo -e "${RED}❌ Booking failed${NC}"; echo "$booking_res" | jq; exit 1; fi
echo -e "${GREEN}✅ Réservation créée : $BOOKING_ID (Statut: PENDING)${NC}"

# === 3. SÉCURITÉ : TEST PAIEMENT BLOQUÉ ===
echo -e "\n${BLUE}--- ÉTAPE 3 : Test Sécurité Paiement ---${NC}"
echo -e "${YELLOW}🛡️ Vérification que le paiement est bien bloqué avant confirmation...${NC}"
pay_check=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CATHIA_TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

if echo "$pay_check" | grep -q "La réservation doit être confirmée"; then
  echo -e "${GREEN}✅ Sécurité validée : Paiement refusé car pas encore confirmé.${NC}"
else
  echo -e "${RED}❌ ÉCHEC SÉCURITÉ : Le paiement n'a pas été bloqué !${NC}"
  echo "$pay_check" | jq
fi

# === 4. SOPHIE : CONFIRMATION ===
echo -e "\n${BLUE}--- ÉTAPE 4 : Sophie (Confirmation) ---${NC}"
echo -e "${YELLOW}📢 Sophie confirme la réservation $BOOKING_ID...${NC}"
confirm_res=$(curl -s -X PUT "$BASE_URL/api/bookings/$BOOKING_ID/confirm" \
  -H "Authorization: Bearer $SOPHIE_TOKEN")

if [ "$(echo $confirm_res | jq -r '.success')" == "true" ]; then
  echo -e "${GREEN}✅ Réservation confirmée par la conductrice !${NC}"
else
  echo -e "${RED}❌ Confirmation failed${NC}"; echo "$confirm_res" | jq; exit 1
fi

# === 5. CATHIA : PAIEMENT ===
echo -e "\n${BLUE}--- ÉTAPE 5 : Cathia (Paiement) ---${NC}"
echo -e "${YELLOW}💸 Création de la session de paiement pour $BOOKING_ID...${NC}"
payment_res=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CATHIA_TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

PAYMENT_URL=$(echo $payment_res | jq -r '.url')

if [ "$PAYMENT_URL" != "null" ]; then
  echo -e "${GREEN}✅ Session de paiement créée avec succès !${NC}"
  echo -e "\n${BLUE}🔗 L'URL DE PAIEMENT EST PRÊTE :${NC}"
  echo -e "${YELLOW}$PAYMENT_URL${NC}"
  echo -e "\n${YELLOW}ℹ️  Une fois payé, le statut passera à 'confirmed' automatiquement.${NC}"
else
  echo -e "${RED}❌ Payment session failed${NC}"; echo "$payment_res" | jq; exit 1
fi

echo -e "\n================================"
echo -e "${GREEN}🎉 TEST FLOW COMPLET RÉUSSI !${NC}"
echo "   Trajet: $TRIP_ID"
echo "   Réservation: $BOOKING_ID"
echo "================================"
