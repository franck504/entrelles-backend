#!/bin/bash

# 🧪 Script de test complet OpenRouteService
# Démarre le backend et teste l'API

echo "🚀 Démarrage du backend..."
echo ""

# Tuer les processus Node existants (port 3000)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Démarrer le backend en arrière-plan
npm run dev > /tmp/entrelles-backend.log 2>&1 &
BACKEND_PID=$!

echo "⏳ Attente démarrage backend (5s)..."
sleep 5

# Vérifier que le backend est démarré
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Le backend n'a pas démarré correctement"
    echo "Logs:"
    cat /tmp/entrelles-backend.log
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend démarré (PID: $BACKEND_PID)"
echo ""

# Lancer le test
./test-google-maps.sh

# Tuer le backend
echo ""
echo "🛑 Arrêt du backend..."
kill $BACKEND_PID 2>/dev/null

echo "✅ Terminé"
