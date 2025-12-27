#!/bin/bash
# test-entrelles-quick.sh - Test Rapide Backend Entrelles

BASE_URL="http://localhost:3000"
PRICE_ID="price_1Siw47JN9J8u3xFmmDBUOLIJ"

echo "🧪 Test Rapide Backend Entrelles"
echo "================================="

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Stripe
echo -e "\n${YELLOW}1️⃣  Test Stripe${NC}"
response=$(curl -s $BASE_URL/test-stripe)
if echo "$response" | grep -q "\"status\":\"OK\""; then
  echo -e "${GREEN}✅ Stripe OK${NC}"
else
  echo -e "${RED}❌ Stripe KO${NC}"
  exit 1
fi

# Test 2: Inscription
echo -e "\n${YELLOW}2️⃣  Test Inscription${NC}"
EMAIL="test.$(date +%s)@entrelles.com"
register=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Test123!\",
    \"displayName\": \"Test User\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"gender\": \"femme\",
    \"phone\": \"+33612345678\"
  }")

TOKEN=$(echo $register | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Inscription échouée${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Utilisateur créé${NC}"
  echo "   Email: $EMAIL"
fi

# Test 3: Checkout
echo -e "\n${YELLOW}3️⃣  Test Checkout${NC}"
checkout=$(curl -s -X POST $BASE_URL/api/payments/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"priceId\": \"$PRICE_ID\"}")

URL=$(echo $checkout | grep -o '"url":"[^"]*' | sed 's/"url":"//' | sed 's/\\//g')
if [ -z "$URL" ]; then
  echo -e "${RED}❌ Checkout échoué${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Checkout créé${NC}"
  echo "   URL: $URL"
fi

echo -e "\n================================="
echo -e "${GREEN}🎉 Tous les tests OK !${NC}"
echo ""
echo "📝 Pour payer :"
echo "   1. Ouvrir: $URL"
echo "   2. Carte: 4242 4242 4242 4242"
echo "   3. Date: 12/35, CVC: 123"
echo ""
echo "🔑 Token: $TOKEN"
