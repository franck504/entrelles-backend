#!/bin/bash
# test-production.sh

BASE_URL="https://entrelles-backend.vercel.app"
PRICE_ID="price_1Siw47JN9J8u3xFmmDBUOLIJ"

echo "🧪 Test Backend Entrelles - PRODUCTION"
echo "======================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${YELLOW}1️⃣  Inscription${NC}"
EMAIL="test.$(date +%s)@entrelles.com"
register=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Test123!\",
    \"displayName\": \"Test Prod\",
    \"firstName\": \"Test\",
    \"lastName\": \"Prod\",
    \"gender\": \"femme\",
    \"phone\": \"+33612345678\"
  }")

TOKEN=$(echo $register | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Inscription échouée${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Utilisateur créé ($EMAIL)${NC}"
fi

echo -e "\n${YELLOW}2️⃣  Création Checkout${NC}"
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
fi

echo -e "\n======================================="
echo -e "${GREEN}🎉 Tests OK !${NC}\n"
echo "📝 Pour payer:"
echo "   $URL"
echo ""
echo "🔑 Token: $TOKEN"
echo "📧 Email: $EMAIL"
