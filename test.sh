#!/bin/bash

# 🎯 TEST COMPLET ABONNEMENT ENTRELLES
echo "🚗 Test abonnement Entrelles - 3€/mois"
echo "========================================"

# Variables
BASE_URL="http://localhost:3000/api"
EMAIL="marie.test.$(date +%s)@gmail.com"  # Email unique

echo "📧 Email de test: $EMAIL"

# 1. Inscription
echo "1️⃣ Inscription utilisatrice..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Password123\",
    \"displayName\": \"Marie Test\",
    \"firstName\": \"Marie\",
    \"lastName\": \"Test\",
    \"gender\": \"femme\",
    \"phone\": \"+33612345678\"
  }")

echo "✅ Réponse inscription:"
echo $REGISTER_RESPONSE | jq '.'

# 2. Extraire le token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
echo "🔑 Token: ${TOKEN:0:50}..."

# 3. Vérifier statut initial
echo "2️⃣ Statut abonnement initial..."
curl -s -X GET $BASE_URL/payments/subscription-status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

# 4. Créer abonnement (avec price_id de test)
echo "3️⃣ Création abonnement 3€/mois..."
SUBSCRIPTION_RESPONSE=$(curl -s -X POST $BASE_URL/payments/create-subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1234567890abcdef"
  }')

echo "✅ Réponse abonnement:"
echo $SUBSCRIPTION_RESPONSE | jq '.'

# 5. Vérifier nouveau statut
echo "4️⃣ Nouveau statut abonnement..."
curl -s -X GET $BASE_URL/payments/subscription-status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo "🎉 Test terminé !"
