#!/bin/bash
# test-confirm-booking.sh - Confirmation de réservation par la conductrice

BASE_URL="https://entrelles-backend.vercel.app"

echo "✅ Confirmation de Réservation - Conductrice"
echo "=========================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# === CONFIGURATION CONDUCTRICE ===
# Sophie Conductrice (celle qui a créé le trajet Paris -> Lyon)
EMAIL="${1:-conductrice.1766895502@entrelles.com}"
PASSWORD="${2:-Cond123!}"

echo -e "\n${YELLOW}👤 Conductrice: $EMAIL${NC}"

# === 1. LOGIN ===
echo -e "\n${YELLOW}1️⃣  Connexion Conductrice${NC}"
login=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $login | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Connexion échouée${NC}"
  echo "$login" | jq
  exit 1
fi

echo -e "${GREEN}✅ Connectée${NC}"

# === 2. LISTER LES RÉSERVATIONS EN ATTENTE ===
echo -e "\n${YELLOW}2️⃣  Recherche des réservations en attente${NC}"
# On utilise le type=driver pour voir les demandes reçues
bookings_res=$(curl -s -X GET "$BASE_URL/api/bookings/my-bookings?type=driver" \
  -H "Authorization: Bearer $TOKEN")

# Trouver la première réservation 'pending'
BOOKING_ID=$(echo $bookings_res | jq -r '.bookings[] | select(.status=="pending") | ._id' | head -1)

if [ "$BOOKING_ID" == "null" ] || [ -z "$BOOKING_ID" ]; then
  echo -e "${RED}❌ Aucune réservation en attente trouvée pour cette conductrice.${NC}"
  echo "Assurez-vous qu'une passagère (Cathia) a fait une demande avec ./test-reservation-cathia.sh"
  exit 1
fi

PASSENGER=$(echo $bookings_res | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .passenger.profile.displayName")
ROUTE=$(echo $bookings_res | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .trip.departure.city + \" -> \" + .trip.arrival.city")

echo -e "${GREEN}✅ Réservation trouvée !${NC}"
echo "   ID: $BOOKING_ID"
echo "   Passagère: $PASSENGER"
echo "   Trajet: $ROUTE"

# === 3. CONFIRMER ===
echo -e "\n${YELLOW}3️⃣  Confirmation de la réservation...${NC}"
confirm_res=$(curl -s -X PUT "$BASE_URL/api/bookings/$BOOKING_ID/confirm" \
  -H "Authorization: Bearer $TOKEN")

SUCCESS=$(echo $confirm_res | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  echo -e "${GREEN}✅ Réservation confirmée avec succès !${NC}"
  echo "La passagère peut maintenant procéder au paiement."
else
  echo -e "${RED}❌ Échec de la confirmation${NC}"
  echo "$confirm_res" | jq
  exit 1
fi

echo -e "\n=========================================="
echo -e "${GREEN}🎉 Opération terminée !${NC}\n"
