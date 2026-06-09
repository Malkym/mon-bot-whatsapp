# WhatsApp Groq Bot - Guide Complet 🤖

Votre assistant IA personnel sur WhatsApp, basé sur le modèle Llama 3.3-70B de Groq.

## 📋 Fonctionnalités

✅ **Réponses IA intelligentes** - Utilise le modèle Llama 3.3-70B de Groq  
✅ **Absence automatique** - Répond pendant vos absences  
✅ **Historique conversationnel** - Mémorise les discussions  
✅ **Profil personnalisé** - Informations localisées (Centrafrique)  
✅ **Rate limiting** - Protection contre le spam  
✅ **Logging structuré** - Traçabilité complète  
✅ **Reconnexion automatique** - Récupération après déconnexion  
✅ **Gestion d'erreurs robuste** - Fallback automatique  

## 🚀 Installation

### 1. Cloner le projet
```bash
cd ~/whatsapp-groq-bot
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Créer le fichier `.env`
```bash
cp .env.example .env
```

### 4. Configurer `.env`
Ouvrir `.env` et remplir les valeurs :

```env
# API Groq (OBLIGATOIRE)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# Votre téléphone (format: code_pays + numéro)
MY_PHONE=23675835276

# Horaires d'absence (quand le bot répond)
ABSENCE_START=20:00
ABSENCE_END=08:00

# Autres paramètres (optionnels)
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_MAX_TOKENS=600
GROQ_TEMPERATURE=0.8

# Urgences
URGENT_PHONE=236XXXXXXXX

# Recherche web optionnelle
WEB_SEARCH_ENABLED=false
WEB_SEARCH_PROVIDER=duckduckgo
# Pour une recherche plus fiable:
# WEB_SEARCH_PROVIDER=brave
# BRAVE_SEARCH_API_KEY=your_brave_key

# Dashboard local
DASHBOARD_ENABLED=true
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3050
# Optionnel mais recommandé si accessible hors machine:
DASHBOARD_TOKEN=change-moi
```

**Où obtenir `GROQ_API_KEY` ?**
1. Aller sur https://console.groq.com
2. Créer un compte gratuit
3. Copier votre clé API

## 📱 Lancer le bot

### Mode développement (logs en temps réel)
```bash
node bot.js
```

Dashboard local: `http://127.0.0.1:3050`  
Si `DASHBOARD_TOKEN` est défini: `http://127.0.0.1:3050?token=VOTRE_TOKEN`

### Mode production (arrière-plan)
```bash
nohup node bot.js > bot.log 2>&1 &
```

### Avec script de contrôle
```bash
chmod +x control.sh
./control.sh start      # Démarrer
./control.sh stop       # Arrêter
./control.sh restart    # Redémarrer
./control.sh status     # Statut
./control.sh logs       # Voir les logs
```

## 🔧 Configurer les horaires d'absence

Modifiez dans `.env` :

```env
# Bot actif de 20h00 à 08h00 (soir + nuit)
ABSENCE_START=20:00
ABSENCE_END=08:00
```

**Cas particuliers:**
- **Toujours répondre:** `ABSENCE_START=00:00` `ABSENCE_END=23:59`
- **Mode démo:** `DEMO_MODE=true`

## 📂 Structure du projet

```
.
├── bot.js                 # Bot principal
├── src/
│   ├── config.js         # Configuration centralisée
│   ├── logger.js         # Système de logging
│   ├── database.js       # Wrapper SQLite3
│   ├── rateLimiter.js    # Protection spam
│   └── services.js       # Services métier
├── .env                  # Configuration (À créer)
├── .env.example          # Exemple de config
├── conversations.db      # Base de données SQLite3
├── logs/                 # Dossier des logs
├── control.sh            # Scripts de gestion
└── package.json          # Dépendances
```

## 📊 Logs et monitoring

Les logs sont sauvegardés dans `logs/`:
- `error.log` - Erreurs critiques
- `warn.log` - Avertissements
- `info.log` - Informations
- `debug.log` - Debugging (si LOG_LEVEL=debug)

Voir les logs en temps réel:
```bash
tail -f logs/info.log
```

## 🔐 Sécurité

- ✅ **API Key** - Stockée dans `.env` (jamais commitée)
- ✅ **Sanitization** - Messages nettoyés avant traitement
- ✅ **Validation** - Entrées validées
- ✅ **Rate Limiting** - Protection contre le spam (10 requêtes/heure par utilisateur)
- ✅ **Timeouts** - API calls avec timeout

## 🐛 Dépannage

### "QR Code à scanner mais rien ne s'affiche"
→ Vérifier la console, relancer `node bot.js`

### "GROQ_API_KEY manquante"
→ Créer `.env` avec `GROQ_API_KEY=your_key`

### "Bot ne répond pas"
→ Vérifier les horaires: `ABSENCE_START` < heure actuelle < `ABSENCE_END`  
→ Vérifier: `./control.sh logs`

### "Trop de messages = rate limit"
→ C'est normal ! Rate limiter protège votre quota API

### "Base de données verrouillée"
→ Relancer le bot

## 🎯 Utilisation

### Pour le propriétaire (votre numéro)
Le bot répond **immédiatement** avec Groq API

### Pour les autres
- **En absence** (20h-08h): Le bot répond comme un assistant
- **En présence** (08h-20h): Le bot ne répond pas
- **Urgent**: "Peux-tu prévenir Malkym?" → bot transfère le message

## 📈 Performance

- Temps réponse moyen: 1-3s
- Quota Groq gratuit: ~100 messages/mois
- Base de données: indexée et optimisée
- Memory usage: ~100-150MB

## 🔄 Mise à jour

```bash
git pull origin main
npm install
./control.sh restart
```

## 📞 Support

- Logs: `./control.sh logs`
- Config: Vérifier `.env` vs `.env.example`
- API Status: https://console.groq.com

## 📄 Licence

ISC

---

**Version:** 2.0 Pro  
**Dernière mise à jour:** 04/06/2026  
**Maintenu par:** Malkym
