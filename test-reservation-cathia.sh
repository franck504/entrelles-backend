#!/bin/bash
# test-reservation-cathia.sh - Test réservation avec Cathia

BASE_URL="https://entrelles-backend.vercel.app"
PRICE_ID="price_1Siw47JN9J8u3xFmmDBUOLIJ"

echo "🎫 Test Réservation - Cathia (Passagère)"
echo "========================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === CONFIGURATION CATHIA ===
EMAIL="cathia@entrelles.com"
PASSWORD="Pass123!"
DISPLAY_NAME="Cathia"

echo -e "\n${YELLOW}👤 Passagère: $DISPLAY_NAME${NC}"

# === 1. INSCRIPTION OU LOGIN ===
echo -e "\n${YELLOW}1️⃣  Connexion/Inscription${NC}"

# Essayer de se connecter d'abord
login=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

TOKEN=$(echo $login | jq -r '.token')

# Si login échoue, créer le compte
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "   Compte n'existe pas, création..."
  
  register=$(curl -s -X POST $BASE_URL/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"password\": \"$PASSWORD\",
      \"displayName\": \"$DISPLAY_NAME\",
      \"firstName\": \"Cathia\",
      \"lastName\": \"Passagère\",
      \"gender\": \"femme\",
      \"phone\": \"+33612345679\"
    }")
  
  TOKEN=$(echo $register | jq -r '.token')
  
  if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Inscription échouée${NC}"
    echo "$register" | jq
    exit 1
  else
    echo -e "${GREEN}✅ Compte créé${NC}"
  fi
else
  echo -e "${GREEN}✅ Connectée${NC}"
fi

# === 2. VÉRIFIER/ACTIVER ABONNEMENT ===
echo -e "\n${YELLOW}2️⃣  Abonnement Premium${NC}"

sub=$(curl -s -X GET $BASE_URL/api/payments/subscription-status \
  -H "Authorization: Bearer $TOKEN")

PLAN=$(echo $sub | jq -r '.subscription.plan')
IS_ACTIVE=$(echo $sub | jq -r '.subscription.isActive')

if [ "$PLAN" == "premium" ] && [ "$IS_ACTIVE" == "true" ]; then
  echo -e "${GREEN}✅ Abonnement déjà actif${NC}"
else
  echo "   Abonnement inactif, création checkout..."
  
  checkout=$(curl -s -X POST $BASE_URL/api/payments/create-checkout \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"priceId\": \"$PRICE_ID\"}")
  
  CHECKOUT_URL=$(echo $checkout | jq -r '.url')
  
  if [ "$CHECKOUT_URL" != "null" ] && [ -n "$CHECKOUT_URL" ]; then
    echo -e "${BLUE}📝 Payer l'abonnement :${NC}"
    echo "   $CHECKOUT_URL"
    echo "   Carte: 4242 4242 4242 4242, Date: 12/35, CVC: 123"
    echo ""
    echo -e "${YELLOW}⏸️  Appuyez sur ENTRÉE après paiement...${NC}"
    read
    
    # Vérifier à nouveau
    sleep 3
    sub=$(curl -s -X GET $BASE_URL/api/payments/subscription-status \
      -H "Authorization: Bearer $TOKEN")
    PLAN=$(echo $sub | jq -r '.subscription.plan')
    IS_ACTIVE=$(echo $sub | jq -r '.subscription.isActive')
  fi
fi

if [ "$PLAN" != "premium" ] || [ "$IS_ACTIVE" != "true" ]; then
  echo -e "${RED}❌ Abonnement Premium requis${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Abonnement Premium actif${NC}"

# === 3. RECHERCHER TRAJETS ===
echo -e "\n${YELLOW}3️⃣  Recherche Trajets Paris → Lyon${NC}"

trips=$(curl -s -X GET "$BASE_URL/api/trips/search?departure=Paris&arrival=Lyon")

TRIP_COUNT=$(echo $trips | jq -r '.trips | length')

if [ "$TRIP_COUNT" == "0" ] || [ "$TRIP_COUNT" == "null" ]; then
  echo -e "${RED}❌ Aucun trajet trouvé${NC}"
  echo "   Créez d'abord un trajet avec: ./test-creer-trajet.sh"
  exit 1
fi

TRIP_ID=$(echo $trips | jq -r '.trips[0]._id')
PRICE=$(echo $trips | jq -r '.trips[0].pricePerSeat')
DRIVER=$(echo $trips | jq -r '.trips[0].driver.displayName')
SEATS=$(echo $trips | jq -r '.trips[0].availableSeats')

echo -e "${GREEN}✅ Trajet trouvé${NC}"
echo "   ID: $TRIP_ID"
echo "   Conductrice: $DRIVER"
echo "   Prix: ${PRICE}€/place"
echo "   Places: $SEATS disponibles"

# === 4. RÉSERVER ===
echo -e "\n${YELLOW}4️⃣  Réservation 1 Place${NC}"

booking=$(curl -s -X POST $BASE_URL/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"tripId\": \"$TRIP_ID\",
    \"numberOfSeats\": 1,
    \"message\": \"Bonjour ! Je souhaite réserver une place pour Lyon. Merci !\"
  }")

BOOKING_ID=$(echo $booking | jq -r '.booking._id')
TOTAL_PRICE=$(echo $booking | jq -r '.booking.totalPrice')
BOOKING_STATUS=$(echo $booking | jq -r '.booking.status')
BOOKING_SUCCESS=$(echo $booking | jq -r '.success')

if [ "$BOOKING_SUCCESS" != "true" ]; then
  echo -e "${RED}❌ Réservation échouée${NC}"
  echo "$booking" | jq
  exit 1
else
  echo -e "${GREEN}✅ Réservation créée${NC}"
  echo "   ID: $BOOKING_ID"
  echo "   Status: $BOOKING_STATUS"
  echo "   Prix total: ${TOTAL_PRICE}€"
fi

# === 5. PAIEMENT TRAJET ===
echo -e "\n${YELLOW}5️⃣  Paiement Trajet${NC}"

payment=$(curl -s -X POST $BASE_URL/api/payments/create-trip-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"bookingId\": \"$BOOKING_ID\"}")

PAYMENT_URL=$(echo $payment | jq -r '.url')
DRIVER_AMOUNT=$(echo $payment | jq -r '.breakdown.driverEur')
COMMISSION=$(echo $payment | jq -r '.breakdown.commissionEur')

if [ "$PAYMENT_URL" == "null" ] || [ -z "$PAYMENT_URL" ]; then
  echo -e "${RED}❌ Création paiement échouée${NC}"
  echo "$payment" | jq
  exit 1
else
  echo -e "${GREEN}✅ Session paiement créée${NC}"
  echo "   Total: ${TOTAL_PRICE}€"
  echo "   → Conductrice: ${DRIVER_AMOUNT}€"
  echo "   → Commission Entrelles: ${COMMISSION}€"
  echo ""
  echo -e "${YELLOW}⚠️  ATTENTION : Si la réservation n'est pas CONFIRMÉE par la conductrice,${NC}"
  echo -e "${YELLOW}   le lien ci-dessous retournera une erreur 400.${NC}"
  echo ""
  echo "💡 Pour confirmer (Conductrice) :"
  echo "   ./test-confirm-booking.sh"
  echo ""
  echo -e "${BLUE}📝 Pour payer :${NC}"
  echo "   $PAYMENT_URL"
  echo "   Carte: 4242 4242 4242 4242, Date: 12/35, CVC: 123"
  echo ""
  echo -e "${YELLOW}⏸️  Appuyez sur ENTRÉE après paiement...${NC}"
  read
fi

# === 6. VÉRIFIER RÉSERVATION ===
echo -e "\n${YELLOW}6️⃣  Vérification Réservation${NC}"
sleep 3

booking_check=$(curl -s -X GET "$BASE_URL/api/bookings/my-bookings" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo $booking_check | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .status")
PAYMENT_STATUS=$(echo $booking_check | jq -r ".bookings[] | select(._id==\"$BOOKING_ID\") | .payment.status")

echo "   Status réservation: $FINAL_STATUS"
echo "   Status paiement: $PAYMENT_STATUS"

if [ "$FINAL_STATUS" == "confirmed" ]; then
  echo -e "${GREEN}✅ Réservation confirmée !${NC}"
else
  echo -e "${YELLOW}⚠️  En attente de paiement final ou confirmation${NC}"
fi

# === RÉSUMÉ ===
echo -e "\n========================================"
echo -e "${GREEN}🎉 Test Réservation Terminé !${NC}\n"
echo "📊 Résumé:"
echo "   Passagère: Cathia ($EMAIL)"
echo "   Trajet: $TRIP_ID"
echo "   Réservation: $BOOKING_ID"
echo "   Prix payé: ${TOTAL_PRICE}€"
echo "   Status: $FINAL_STATUS"
echo ""
echo "💰 Répartition:"
echo "   Conductrice reçoit: ${DRIVER_AMOUNT}€ (dans 7 jours)"
echo "   Commission Entrelles: ${COMMISSION}€"
