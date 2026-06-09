# 🚀 WhatsApp Groq Bot - Déploiement en Production

Guide pour déployer votre bot en production sur un serveur Linux.

## 📋 Prérequis

- Serveur Linux (Ubuntu 20.04+)
- Node.js 14+
- npm 6+
- 500MB d'espace disque minimum
- Connexion Internet stable

## 🔧 Installation sur serveur

### 1. SSH sur votre serveur
```bash
ssh user@your-server.com
```

### 2. Cloner le projet
```bash
git clone https://github.com/yourusername/whatsapp-groq-bot.git
cd whatsapp-groq-bot
```

### 3. Installer les dépendances
```bash
chmod +x install.sh
./install.sh
```

### 4. Configurer l'environnement
```bash
nano .env
# Ajouter votre GROQ_API_KEY et autres paramètres
```

## 🎯 Démarrage du bot

### Option 1: Avec control.sh
```bash
./control.sh start     # Démarrer
./control.sh status    # Vérifier
./control.sh logs      # Logs
```

### Option 2: Avec nohup
```bash
nohup node bot.js > bot.log 2>&1 &
```

### Option 3: Avec systemd (recommandé)

Créer `/etc/systemd/system/whatsapp-bot.service`:

```ini
[Unit]
Description=WhatsApp Groq Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/whatsapp-groq-bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
StandardOutput=append:/home/ubuntu/whatsapp-groq-bot/bot.log
StandardError=append:/home/ubuntu/whatsapp-groq-bot/bot.log

[Install]
WantedBy=multi-user.target
```

Puis:
```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-bot
sudo systemctl start whatsapp-bot
```

## 📊 Monitoring

### Vérifier le statut
```bash
./control.sh status
# ou
sudo systemctl status whatsapp-bot
```

### Voir les logs
```bash
./control.sh logs
# ou
tail -f logs/error.log
```

### Utilisation des ressources
```bash
ps aux | grep "node bot.js"
```

## 🔐 Sécurité

- ✅ Stocker `.env` de manière sécurisée (pas dans git)
- ✅ Utiliser des permissions restrictives
- ✅ Firewall: ouvrir que les ports nécessaires
- ✅ Backup régulier de `conversations.db`
- ✅ Monitoring des logs d'erreur

## 📈 Optimisation

### Augmenter les ressources
```bash
# Dans control.sh, augmenter le max_tokens
GROQ_MAX_TOKENS=1000
```

### Cache optimisé
- Logs archivés automatiquement
- Base de données indexée
- Rate limiting actif

### Limite de mémoire
```bash
# Lancer avec limite mémoire
node --max-old-space-size=256 bot.js
```

## 🆘 Dépannage

### Bot qui crash
```bash
# Vérifier les logs
./control.sh logs
# Redémarrer
./control.sh restart
```

### QR code n'apparaît pas
```bash
# SSH impossible ? Vérifier SSH forwarding
ssh -X user@server
```

### Erreur API Groq
- Vérifier GROQ_API_KEY
- Vérifier votre quota API
- Vérifier la connexion Internet

## 🔄 Mise à jour

```bash
git pull
npm install
./control.sh restart
```

## 📦 Backup

```bash
# Sauvegarder la base de données
cp conversations.db conversations.db.backup

# Sauvegarder les logs
tar -czf logs-backup.tar.gz logs/
```

## 📞 Support

- Documentation: README.md
- Logs: `./control.sh logs`
- Config: `.env.example`
- Issues: Vérifier les erreurs dans logs/error.log

---

**Note**: Pour les appels WhatsApp entrants, le bot doit être connecté en permanence. Ne pas fermer la session WhatsApp depuis l'application téléphone.
