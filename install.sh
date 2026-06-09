#!/bin/bash
# ============================================
# Installation du WhatsApp Groq Bot v2.0
# ============================================

set -e  # Arrêter en cas d'erreur

echo "╔════════════════════════════════════════╗"
echo "║    🤖 Installation WhatsApp Groq Bot   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Vérifier Node.js
echo "✓ Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "   Télécharger depuis: https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  ✅ Node.js $NODE_VERSION détecté"
echo ""

# Vérifier npm
echo "✓ Vérification de npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "  ✅ npm $NPM_VERSION détecté"
echo ""

# Créer .env s'il n'existe pas
echo "✓ Configuration..."
if [ ! -f ".env" ]; then
    echo "  → Création de .env..."
    cp .env.example .env
    echo "  ✅ .env créé - À ÉDITER AVEC VOTRE GROQ_API_KEY"
else
    echo "  ✅ .env existe déjà"
fi
echo ""

# Installer les dépendances
echo "✓ Installation des dépendances..."
npm install
echo "  ✅ Dépendances installées"
echo ""

# Créer les dossiers nécessaires
echo "✓ Création des dossiers..."
mkdir -p logs wwebjs_auth
echo "  ✅ Dossiers créés"
echo ""

# Rendre les scripts exécutables
echo "✓ Configuration des scripts..."
chmod +x control.sh clean.sh
echo "  ✅ Scripts exécutables"
echo ""

# Tester la configuration
echo "✓ Test de la configuration..."
if npm run test 2>/dev/null; then
    echo "  ✅ Configuration valide"
else
    echo "  ⚠️ Certains tests échoués (vérifier .env)"
fi
echo ""

echo "╔════════════════════════════════════════╗"
echo "║      ✅ Installation terminée!        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Éditer .env et ajouter votre GROQ_API_KEY"
echo "  2. Lancer: ./control.sh start"
echo "  3. Scanner le QR code avec WhatsApp"
echo ""
echo "💡 Aide:"
echo "  ./control.sh status     - Vérifier l'état"
echo "  ./control.sh logs       - Voir les logs"
echo "  npm run test            - Tester la config"
echo ""
