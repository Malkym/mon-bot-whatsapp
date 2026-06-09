# 📝 Capacités et Limitations du Bot

## ✅ Capacités

### Conversation naturelle
- ✅ Comprend le contexte et l'historique
- ✅ Utilise le profil complet de Malkym (`profile.js`)
- ✅ Utilise une mémoire long terme simple par contact
- ✅ Répond en français naturellement
- ✅ Adapte le ton selon la situation
- ✅ Gère les urgences avec propositions claires
- ✅ Peut intégrer une recherche web optionnelle

### Automatisation
- ✅ Répond 24/7 selon les horaires configurés
- ✅ Gère différents statuts (travail, dodo, repos, église)
- ✅ Mémorise les conversations
- ✅ Salue au premier message, puis seulement après 10 minutes de silence
- ✅ Transmet les messages urgents au numéro configuré
- ✅ Enregistre les médias reçus et sait répondre prudemment à leur sujet
- ✅ Dashboard local pour suivre stats, contacts, mémoire et messages récents

### Sécurité & Performance
- ✅ Rate limiting (évite le spam)
- ✅ Sanitization des messages
- ✅ Logs complets pour audit
- ✅ Reconnexion automatique

---

## ⚠️ Limitations du modèle Llama 3.3-70B

### ⚠️ Recherche en ligne optionnelle
**Le modèle seul ne peut PAS accéder à Internet**, mais le bot peut maintenant faire une recherche externe si:
- `WEB_SEARCH_ENABLED=true`
- Provider `duckduckgo` sans clé, ou `brave` avec `BRAVE_SEARCH_API_KEY`

**Pourquoi?** 
Groq API gratuit n'inclut PAS l'accès web. C'est une limitation du service.
Le bot ajoute donc une couche de recherche séparée, puis donne les résultats au modèle.

### ⚠️ Médias
- Les images, vidéos, vocaux et documents sont détectés et enregistrés
- Le bot ne fait pas encore d'analyse visuelle/audio profonde du contenu
- Il accuse réception et demande une précision si nécessaire

### ⚠️ Autres limitations
- **Contexte limité:** Seulement les 5 derniers messages (configurable)
- **Token limit:** Max 600 tokens de réponse
- **Hallucinations:** Peut inventer des faits
- **Mémoire long terme simple:** Extrait seulement certains faits évidents

---

## 🚀 Solutions possibles

Si vous voulez renforcer encore la recherche en ligne:

### Option 1: Utiliser une API payante
```
- OpenAI GPT-4 + Browsing
- Claude 3 + Web Search
- Groq (version pro avec web access)
```

### Option 2: Intégrer une recherche manuelle
```javascript
// Pseudo-code
1. Détecter les questions de recherche
2. Faire une recherche Google/Bing
3. Résumer les résultats
4. Inclure dans la réponse IA
```

### Option 3: Utiliser une solution hybride
```
- Moteur de recherche pour infos
- IA pour la conversation
- Fusion des deux
```

---

## 📊 Configuration actuelle

| Paramètre | Valeur | Note |
|-----------|--------|------|
| **Modèle** | Llama 3.3-70B | Très bon pour conversations |
| **Température** | 0.8 | Créatif mais pas trop |
| **Max Tokens** | 600 | Réponses de taille moyenne |
| **Contexte** | 5 messages | Les 5 derniers messages |
| **Recherche** | Optionnelle | `WEB_SEARCH_ENABLED=true` |
| **Urgence** | MY_PHONE / URGENT_PHONE | Numéro alerté en cas d'urgence |
| **Dashboard** | 127.0.0.1:3050 | Activé par défaut |

---

## 💡 Utilisation recommandée

### ✅ Bon pour
- Conversations naturelles
- FAQ automatisées
- Support de base
- Assistanat personnel
- Explications générales

### ❌ Pas bon pour
- Recherche en temps réel
- Données actualisées
- Vérification de faits
- Requêtes API externes

---

## 🔧 Améliorations futures possibles

1. **Augmenter le contexte** → Rétenir plus de messages
2. **Analyse médias avancée** → Vision/audio transcription
3. **Rappels et agenda** → Tâches persistantes
4. **Multi-modèles** → Passer entre différents modèles
5. **Mémoire IA résumée** → Résumés automatiques par contact

---

**Version:** 2.0 PRO  
**Dernière mise à jour:** 05/06/2026
