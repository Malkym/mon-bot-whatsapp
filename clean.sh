#!/bin/bash
# ============================================
# Nettoyage des fichiers de session
# ============================================

echo "🧹 Nettoyage de WhatsApp Groq Bot..."

# Arrêter le processus
echo "  → Arrêt du bot..."
pkill -f "node bot.js"
sleep 2

# Nettoyer la session
echo "  → Nettoyage de la session WhatsApp..."
rm -rf ~/.wwebjs_auth/session
rm -rf ./wwebjs_auth/session

# Nettoyer les logs anciens
echo "  → Archivage des anciens logs..."
if [ -d "./logs" ]; then
    ARCHIVE_DIR="./logs/archived-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$ARCHIVE_DIR"
    find ./logs -maxdepth 1 -name "*.log" -exec mv {} "$ARCHIVE_DIR" \;
fi

echo "✅ Nettoyage terminé"
echo ""
echo "💡 Prochaines étapes:"
echo "  1. Lancer: ./control.sh start"
echo "  2. Scanner le QR code avec WhatsApp"
