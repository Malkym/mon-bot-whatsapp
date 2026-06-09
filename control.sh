#!/bin/bash
# ============================================
# Gestion du bot WhatsApp Groq
# ============================================

cd "$(dirname "$0")" || exit 1

case "$1" in
    start)
        echo "🚀 Démarrage du bot..."
        nohup node bot.js > bot.log 2>&1 &
        PID=$!
        echo "✅ Bot démarré (PID: $PID)"
        ;;
    
    stop)
        echo "🛑 Arrêt du bot..."
        pkill -f "node bot.js"
        sleep 1
        if ! pgrep -f "node bot.js" > /dev/null; then
            echo "✅ Bot arrêté"
        else
            echo "⚠️ Le bot s'arrête..."
            sleep 2
        fi
        ;;
    
    restart)
        echo "🔄 Redémarrage du bot..."
        $0 stop
        sleep 2
        $0 start
        ;;
    
    status)
        if pgrep -f "node bot.js" > /dev/null; then
            PID=$(pgrep -f "node bot.js")
            echo "✅ Bot en cours d'exécution (PID: $PID)"
        else
            echo "❌ Bot arrêté"
        fi
        ;;
    
    logs)
        if [ -f "bot.log" ]; then
            tail -f bot.log
        else
            echo "❌ Fichier log non trouvé"
        fi
        ;;
    
    logs-error)
        if [ -d "logs" ]; then
            tail -f logs/error.log
        else
            echo "❌ Dossier logs non trouvé"
        fi
        ;;
    
    clean)
        echo "🧹 Nettoyage..."
        pkill -f "node bot.js"
        rm -rf ./wwebjs_auth/session
        echo "✅ Session WhatsApp nettoyée"
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|logs-error|clean}"
        echo ""
        echo "Commandes:"
        echo "  start         - Démarrer le bot en arrière-plan"
        echo "  stop          - Arrêter le bot"
        echo "  restart       - Redémarrer le bot"
        echo "  status        - Vérifier l'état du bot"
        echo "  logs          - Afficher les logs en direct (bot.log)"
        echo "  logs-error    - Afficher les erreurs (logs/error.log)"
        echo "  clean         - Nettoyer la session WhatsApp"
        exit 1
        ;;
esac