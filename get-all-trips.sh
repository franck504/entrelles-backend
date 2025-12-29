#!/bin/bash
# get-all-trips.sh - Voir tous les trajets disponibles (SANS authentification)

BASE_URL="https://entrelles-backend.vercel.app"

echo "🔍 Liste de Tous les Trajets Disponibles"
echo "========================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === RÉCUPÉRER TOUS LES TRAJETS (PUBLIC, SANS TOKEN) ===
echo -e "\n${YELLOW}📋 Récupération des trajets...${NC}"

all_trips=$(curl -s -X GET "$BASE_URL/api/trips/search" \
  -H "Content-Type: application/json")

# Afficher la réponse brute
echo -e "\n${BLUE}Réponse API:${NC}"
echo "$all_trips" | jq '.'

# Compter les trajets
TRIP_COUNT=$(echo "$all_trips" | jq -r '.trips | length // 0')

echo -e "\n${GREEN}✅ Total: $TRIP_COUNT trajet(s) trouvé(s)${NC}"

# Afficher les détails de chaque trajet
if [ "$TRIP_COUNT" -gt 0 ]; then
  echo -e "\n${YELLOW}Détails des trajets:${NC}"
  echo "$all_trips" | jq -r '.trips[] | "\n📍 \(.departure.city) → \(.arrival.city)\n   💰 Prix: \(.pricePerSeat)€/place\n   🪑 Places: \(.availableSeats)/\(.total Seats)\n   📅 Départ: \(.departureDateTime)\n   🆔 ID: \(.id)"'
fi

echo ""
