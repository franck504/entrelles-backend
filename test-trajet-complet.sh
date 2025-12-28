#!/bin/bash
# test-trajet-complet.sh - Test réservation et paiement trajet

BASE_URL="https://entrelles-backend.vercel.app"

echo "🎫 Test Réservation Trajet - Entrelles"
echo "======================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier si un trajet existe
echo -e "\n${YELLOW}1️⃣  Recherche de trajets${NC}"
trips=$(curl -s -X GET "$BASE_URL/api/trips/search?departure=Paris&arrival=Lyon" \
  -H "Content-Type: application/json")

TRIP_COUNT=$(echo $trips | jq -r '.trips | length')

if [ "$TRIP_COUNT" == "0" ] || [ "$TRIP_COUNT" == "null" ]; then
  echo -e "${RED}❌ Aucun trajet disponible${NC}"
  echo "   Créez d'abord un trajet avec ./test-conductrice.sh"
  exit 1
fi

TRIP_ID=$(echo $trips | jq -r '.trips[0].id')
PRICE=$(echo $trips | jq -r '.trips[0].pricePerSeat')
DRIVER=$(echo $trips | jq -r '.trips[0].driver.displayName')

echo -e "${GREEN}✅ Trajet trouvé !${NC}"
echo "   ID: $TRIP_ID"
echo "   Conductrice: $DRIVER"
echo "   Prix: ${PRICE}€/place"

# === 2. INSCRIPTION PASSAGÈRE ===
echo -e "\n${YELLOW}2️⃣  Inscription Passagère${NC}"
EMAIL="passagere.$(date +%s)@entrelles.com"
register=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Pass123!\",
    \"displayName\": \"Marie Passagère\",
    \"firstName\": \"Marie\",
    \"lastName\": \"Dupont\",
    \"gender\": \"femme\",
    \"phone\": \"+33612345678\"
  }")

TOKEN=$(echo $register | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Inscription échouée${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Passagère créée${NC}"
  echo "   Email: $EMAIL"
fi

# === 3. ABONNEMENT (simplifié) ===
echo -e "\n${YELLOW}3️⃣  Abonnement Premium${NC}"
echo -e "${BLUE}Note: Pour simplifier, créez l'abonnement manuellement${NC}"
echo -e "${YELLOW}Appuyez sur ENTRÉE une fois l'abonnement activé...${NC}"
read

# === 4. RÉSERVER ===
echo -e "\n${YELLOW}4️⃣  Réservation${NC}"
booking=$(curl -s -X POST $BASE_URL/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"tripId\": \"$TRIP_ID\",
    \"numberOfSeats\": 1,
    \"message\": \"Bonjour, je souhaite réserver une place !\"
  }")

BOOKING_ID=$(echo $booking | jq -r '.booking.id')
TOTAL_PRICE=$(echo $booking | jq -r '.booking.totalPrice')

if [ "$BOOKING_ID" == "null" ]; then
  echo -e "${RED}❌ Réservation échouée${NC}"
  echo "$booking" | jq
  exit 1
else
  echo -e "${GREEN}✅ Réservation créée${NC}"
  echo "   ID: $BOOKING_ID"
  echo "   Prix total: ${TOTAL_PRICE}€"
fi

# === 5. PAIEMENT ===
echo -e "\n${YELLOW}5️⃣  Paiement Trajet${NC}"
payment=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

PAYMENT_URL=$(echo $payment | jq -r '.url')
DRIVER_AMOUNT=$(echo $payment | jq -r '.breakdown.driverEur')
COMMISSION=$(echo $payment | jq -r '.breakdown.commissionEur')

if [ "$PAYMENT_URL" == "null" ]; then
  echo -e "${RED}❌ Paiement échoué${NC}"
  echo "$payment" | jq
  exit 1
else
  echo -e "${GREEN}✅ Paiement créé${NC}"
  echo "   Total: ${TOTAL_PRICE}€"
  echo "   → Conductrice: ${DRIVER_AMOUNT}€"
  echo "   → Commission: ${COMMISSION}€"
  echo ""
  echo -e "${BLUE}📝 Pour payer :${NC}"
  echo "   $PAYMENT_URL"
fi

echo -e "\n======================================"
echo -e "${GREEN}🎉 Test Réservation Complet !${NC}"
echo ""
echo "📊 Résumé:"
echo "   Trajet: $TRIP_ID"
echo "   Réservation: $BOOKING_ID"
echo "   Passagère: $EMAIL"
echo "   Prix: ${TOTAL_PRICE}€"
