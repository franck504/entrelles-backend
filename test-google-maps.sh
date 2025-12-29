#!/bin/bash

# 🧪 Script de test Google Maps - Backend Entrelles
# Ce script teste l'endpoint de calcul d'itinéraire en local

echo "🗺️  Test Google Maps Backend - Entrelles"
echo "========================================="
echo ""

# Couleurs pour les sorties
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL du backend local
BACKEND_URL="http://localhost:3000"

echo "📍 Test 1: Health Check"
echo "----------------------"
curl -s "$BACKEND_URL/health" | jq '.'
echo ""

echo "📍 Test 2: Calcul itinéraire Paris → Lyon"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/maps/calculate-route" \
  -H "Content-Type: application/json" \
  -d '{
    "departure": {
      "latitude": 48.8566,
      "longitude": 2.3522,
      "address": "Paris, France"
    },
    "arrival": {
      "latitude": 45.7640,
      "longitude": 4.8357,
      "address": "Lyon, France"
    },
    "availableSeats": 3
  }')

echo "$RESPONSE" | jq '.'

# Vérifier le résultat
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    DISTANCE=$(echo "$RESPONSE" | jq -r '.data.distance')
    DURATION=$(echo "$RESPONSE" | jq -r '.data.duration')
    PRICE=$(echo "$RESPONSE" | jq -r '.data.pricePerSeat')
    
    echo ""
    echo -e "${GREEN}✅ Test réussi !${NC}"
    echo "📏 Distance: ${DISTANCE} km"
    echo "⏱️  Durée: ${DURATION}h"
    echo "💶 Prix/siège: ${PRICE}€"
else
    echo -e "${RED}❌ Test échoué${NC}"
    echo "Vérifiez que:"
    echo "1. Le backend est démarré (npm run dev)"
    echo "2. La clé GOOGLE_MAPS_API_KEY est dans .env"
    echo "3. Les APIs sont activées sur Google Cloud"
fi

echo ""
echo "📍 Test 3: Cache Stats"
echo "--------------------"
curl -s "$BACKEND_URL/api/maps/cache-stats" | jq '.'

echo ""
echo "========================================="
echo "✅ Tests terminés"
