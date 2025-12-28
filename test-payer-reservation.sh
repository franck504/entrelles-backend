#!/bin/bash
# test-payer-reservation.sh - Payer une réservation existante

BASE_URL="https://entrelles-backend.vercel.app"
EMAIL="cathia@entrelles.com"
PASSWORD="Pass123!"

echo "💳 Paiement Réservation Cathia"
echo "=============================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Login
echo -e "\n${YELLOW}1️⃣  Connexion${NC}"
login=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $login | jq -r '.token')

if [ "$TOKEN" == "null" ]; then
  echo -e "${RED}❌ Connexion échouée${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Connectée${NC}"

# Récupérer la dernière réservation
echo -e "\n${YELLOW}2️⃣  Recherche réservation en attente${NC}"
bookings=$(curl -s -X GET "$BASE_URL/api/bookings/my-bookings" \
  -H "Authorization: Bearer $TOKEN")

BOOKING_ID=$(echo $bookings | jq -r '.bookings[] | select(.status=="pending") | ._id' | head -1)

if [ "$BOOKING_ID" == "null" ] || [ -z "$BOOKING_ID" ]; then
  echo -e "${RED}❌ Aucune réservation en attente${NC}"
  echo "Créez d'abord une réservation avec: ./test-reservation-cathia.sh"
  exit 1
fi

TOTAL=$(echo $bookings | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .totalPrice")

echo -e "${GREEN}✅ Réservation trouvée${NC}"
echo "   ID: $BOOKING_ID"
echo "   Prix: ${TOTAL}€"

# Créer le paiement
echo -e "\n${YELLOW}3️⃣  Création paiement${NC}"
payment=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

URL=$(echo $payment | jq -r '.url')
DRIVER_EUR=$(echo $payment | jq -r '.breakdown.driverEur')
COMMISSION=$(echo $payment | jq -r '.breakdown.commissionEur')

if [ "$URL" == "null" ]; then
  echo -e "${RED}❌ Erreur création paiement${NC}"
  echo "$payment" | jq
  exit 1
fi

echo -e "${GREEN}✅ Paiement créé${NC}"
echo "   Total: ${TOTAL}€"
echo "   → Conductrice: ${DRIVER_EUR}€ (dans 7 jours)"
echo "   → Commission: ${COMMISSION}€"
echo ""
echo -e "${BLUE}📝 Pour payer :${NC}"
echo "   $URL"
echo "   Carte: 4242 4242 4242 4242"
echo "   Date: 12/35, CVC: 123"
echo ""
echo -e "${YELLOW}⏸️  Appuyez sur ENTRÉE après paiement...${NC}"
read

# Vérifier confirmation
echo -e "\n${YELLOW}4️⃣  Vérification${NC}"
sleep 3

final=$(curl -s -X GET "$BASE_URL/api/bookings/my-bookings" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $final | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .status")
PAYMENT_STATUS=$(echo $final | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .payment.status")

echo "   Status réservation: $STATUS"
echo "   Status paiement: $PAYMENT_STATUS"

if [ "$STATUS" == "confirmed" ]; then
  echo -e "\n${GREEN}🎉 Réservation confirmée et payée !${NC}"
else
  echo -e "\n${YELLOW}⚠️  En attente de confirmation${NC}"
fi
