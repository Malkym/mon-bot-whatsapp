#!/bin/bash
# ============================================
# Archivage des anciens fichiers
# ============================================

BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"

echo "📦 Archivage des fichiers anciens..."
mkdir -p "$BACKUP_DIR"

# Archiver les anciennes versions
if [ -f "bot-avance.js" ]; then
    mv bot-avance.js "$BACKUP_DIR/"
    echo "  ✓ bot-avance.js archivé"
fi

if [ -f "profile.js" ]; then
    mv profile.js "$BACKUP_DIR/"
    echo "  ✓ profile.js archivé"
fi

echo "✅ Archivage terminé: $BACKUP_DIR"
