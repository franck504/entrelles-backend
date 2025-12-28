#!/bin/bash
# test-conductrice.sh - Test complet flow conductrice

BASE_URL="https://entrelles-backend.vercel.app"
PRICE_ID="price_1Siw47JN9J8u3xFmmDBUOLIJ"

echo "🚗 Test Flow Conductrice - Entrelles"
echo "====================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === 1. INSCRIPTION ===
echo -e "\n${YELLOW}1️⃣  Inscription Conductrice${NC}"
EMAIL="conductrice.$(date +%s)@entrelles.com"
register=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Cond123!\",
    \"displayName\": \"Sophie Conductrice\",
    \"firstName\": \"Sophie\",
    \"lastName\": \"Martin\",
    \"gender\": \"femme\",
    \"phone\": \"+33687654321\"
  }")

TOKEN=$(echo $register | grep -o '"token":"[^"]*' | sed 's/"token":"//')
USER_ID=$(echo $register | jq -r '.user.id')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Inscription échouée${NC}"
  echo "$register" | jq
  exit 1
else
  echo -e "${GREEN}✅ Conductrice créée${NC}"
  echo "   Email: $EMAIL"
  echo "   ID: $USER_ID"
fi

# === 2. ABONNEMENT PREMIUM ===
echo -e "\n${YELLOW}2️⃣  Abonnement Premium${NC}"
checkout=$(curl -s -X POST $BASE_URL/api/payments/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"priceId\": \"$PRICE_ID\"}")

CHECKOUT_URL=$(echo $checkout | grep -o '"url":"[^"]*' | sed 's/"url":"//' | sed 's/\\//g')

if [ -z "$CHECKOUT_URL" ]; then
  echo -e "${RED}❌ Checkout échoué${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Checkout créé${NC}"
  echo -e "${BLUE}📝 Action requise :${NC}"
  echo "   1. Ouvrir: $CHECKOUT_URL"
  echo "   2. Carte: 4242 4242 4242 4242"
  echo "   3. Date: 12/35, CVC: 123"
  echo ""
  echo -e "${YELLOW}⏸️  Appuyez sur ENTRÉE après avoir payé...${NC}"
  read
fi

# === 3. VÉRIFIER ABONNEMENT ===
echo -e "\n${YELLOW}3️⃣  Vérification Abonnement${NC}"
sleep 3  # Attendre traitement webhook
subscription=$(curl -s -X GET $BASE_URL/api/payments/subscription-status \
  -H "Authorization: Bearer $TOKEN")

PLAN=$(echo $subscription | jq -r '.subscription.plan')
IS_ACTIVE=$(echo $subscription | jq -r '.subscription.isActive')

if [ "$PLAN" == "premium" ] && [ "$IS_ACTIVE" == "true" ]; then
  echo -e "${GREEN}✅ Abonnement Premium actif${NC}"
else
  echo -e "${RED}❌ Abonnement non actif${NC}"
  echo "$subscription" | jq
  exit 1
fi

# === 4. DÉMARRER KYC ===
echo -e "\n${YELLOW}4️⃣  Démarrage KYC Stripe Connect${NC}"
kyc=$(curl -s -X POST $BASE_URL/api/kyc/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

KYC_URL=$(echo $kyc | jq -r '.onboarding.url')

if [ "$KYC_URL" == "null" ] || [ -z "$KYC_URL" ]; then
  echo -e "${RED}❌ KYC non démarré${NC}"
  echo "$kyc" | jq
  exit 1
else
  echo -e "${GREEN}✅ KYC démarré${NC}"
  echo -e "${BLUE}📝 Action requise :${NC}"
  echo "   1. Ouvrir: $KYC_URL"
  echo "   2. Compléter le formulaire Stripe Connect"
  echo "   3. Utiliser IBAN test: FR1420041010050500013M02606"
  echo ""
  echo -e "${YELLOW}⏸️  Appuyez sur ENTRÉE après avoir complété le KYC...${NC}"
  read
fi

# === 5. VÉRIFIER STATUT KYC ===
echo -e "\n${YELLOW}5️⃣  Vérification KYC${NC}"
sleep 3
kyc_status=$(curl -s -X GET $BASE_URL/api/kyc/status \
  -H "Authorization: Bearer $TOKEN")

KYC_STATUS=$(echo $kyc_status | jq -r '.kyc.status')
CAN_RECEIVE=$(echo $kyc_status | jq -r '.kyc.canReceivePayments')

echo "   Status: $KYC_STATUS"
echo "   Peut recevoir paiements: $CAN_RECEIVE"

if [ "$KYC_STATUS" == "verified" ]; then
  echo -e "${GREEN}✅ KYC Vérifié !${NC}"
else
  echo -e "${YELLOW}⚠️  KYC en attente (normal si pas encore complété)${NC}"
  echo "   Vous pourrez créer des trajets après vérification"
fi

# === 6. CRÉER UN TRAJET ===
echo -e "\n${YELLOW}6️⃣  Création d'un Trajet${NC}"

if [ "$KYC_STATUS" != "verified" ]; then
  echo -e "${YELLOW}⏸️  KYC non vérifié, impossible de créer un trajet maintenant${NC}"
  echo "   Complétez le KYC d'abord, puis relancez ce test"
else
  # Trajet Paris → Lyon
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
      "departureDateTime": "2025-07-25T14:00:00Z",
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
  
  if [ "$TRIP_ID" != "null" ] && [ -n "$TRIP_ID" ]; then
    PRICE_PER_SEAT=$(echo $trip | jq -r '.trip.pricePerSeat')
    echo -e "${GREEN}✅ Trajet créé !${NC}"
    echo "   ID: $TRIP_ID"
    echo "   Prix par place: ${PRICE_PER_SEAT}€"
    echo "   Places disponibles: 3"
  else
    echo -e "${RED}❌ Création trajet échouée${NC}"
    echo "$trip" | jq
  fi
fi

# === RÉSUMÉ ===
echo -e "\n====================================="
echo -e "${GREEN}🎉 Test Conductrice Terminé !${NC}\n"
echo "📊 Résumé:"
echo "   Email: $EMAIL"
echo "   Token: $TOKEN"
echo "   Abonnement: $PLAN ($IS_ACTIVE)"
echo "   KYC: $KYC_STATUS"

if [ "$KYC_STATUS" == "verified" ] && [ -n "$TRIP_ID" ]; then
  echo "   Trajet: $TRIP_ID"
fi

echo ""
echo "📝 Prochaines étapes:"
if [ "$KYC_STATUS" != "verified" ]; then
  echo "   1. Compléter le KYC: $KYC_URL"
  echo "   2. Relancer ce script pour créer un trajet"
else
  echo "   ✅ Vous pouvez maintenant créer d'autres trajets !"
fi
