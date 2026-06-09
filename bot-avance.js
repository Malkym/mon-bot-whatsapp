const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { MY_PROFILE } = require('./profile.js');
require('dotenv').config();

// ========== LOCALISATION ET HEURE ==========
const MY_COUNTRY = "Centrafrique";
const MY_CITY = "Bangui";
const MY_TIMEZONE = "Africa/Bangui"; // GMT+1

function getLocalTime() {
    const now = new Date();
    const options = { 
        timeZone: MY_TIMEZONE, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        weekday: 'long',
        day: '2-digit',
        month: 'long'
    };
    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    return formatter.format(now);
}

function getCurrentHour() {
    const now = new Date();
    const options = { timeZone: MY_TIMEZONE, hour: '2-digit', hour12: false };
    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    return parseInt(formatter.format(now));
}

// ========== CONFIGURATION ==========
const MY_NAME = "Malkym";
const BOT_NAME = "MalkymBot";
const MY_PHONE = process.env.MY_PHONE || "23675835276";
const ABSENCE_START = process.env.ABSENCE_START || "20:00";
const ABSENCE_END = process.env.ABSENCE_END || "08:00";

// Base de données pour la mémoire
const db = new sqlite3.Database('./conversations.db');

db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
    phone TEXT PRIMARY KEY,
    name TEXT,
    interests TEXT,
    last_seen DATETIME
)`);

function saveMessage(phone, role, content) {
    db.run(`INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)`, [phone, role, content]);
}

async function getConversationHistory(phone, limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT role, content FROM messages WHERE phone = ? ORDER BY timestamp DESC LIMIT ?`, [phone, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.reverse());
        });
    });
}

function saveUserProfile(phone, name) {
    db.run(`INSERT OR REPLACE INTO user_profiles (phone, name, last_seen) VALUES (?, ?, ?)`, [phone, name, new Date().toISOString()]);
}

function isBotActive() {
    const now = new Date();
    // Utiliser l'heure locale pour la comparaison
    const currentHour = getCurrentHour();
    const currentMinute = new Date().getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    const [startHour, startMinute] = ABSENCE_START.split(":").map(Number);
    const [endHour, endMinute] = ABSENCE_END.split(":").map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
    } else {
        return currentTime >= startTime && currentTime < endTime;
    }
}

function getGreeting() {
    const hour = getCurrentHour();
    if (hour < 12) return "🌅 Bonjour";
    if (hour < 18) return "☀️ Bon après-midi";
    return "🌙 Bonsoir";
}

function getRandomEmoji() {
    const emojis = ['😊', '🌟', '✨', '🤗', '💫', '🎯', '💪', '🔥', '⭐', '🌸', '🎉', '💡', '🤖'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Scanne ce QR code avec WhatsApp');
});

client.on('ready', () => {
    const localTime = getLocalTime();
    console.log(`\n✅ ${BOT_NAME} connecté !`);
    console.log(`📍 Localisation: ${MY_COUNTRY} - ${MY_CITY}`);
    console.log(`🕐 Heure locale: ${localTime}`);
    console.log(`📅 Plage d'absence: ${ABSENCE_START} → ${ABSENCE_END}`);
    console.log(`🤖 Statut: ${isBotActive() ? 'ABSENT (bot actif)' : 'PRÉSENT (bot inactif)'}\n`);
});

client.on('message', async msg => {
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    if (msg.from.includes('@g.us')) return;
    
    const phone = msg.from.replace('@c.us', '');
    const isOwner = (phone === MY_PHONE);
    
    let senderName = "mon ami";
    try {
        const contact = await msg.getContact();
        senderName = contact.pushname || contact.id.user.split('@')[0];
        saveUserProfile(phone, senderName);
    } catch(e) {}
    
    console.log(`📨 ${senderName}: ${msg.body?.substring(0, 50)}`);
    saveMessage(phone, "user", msg.body);
    
    if (!msg.body || msg.body.trim() === '') return;
    
    // Propriétaire: réponse normale
    if (isOwner) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions',
                { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: msg.body }], max_tokens: 500 },
                { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            const reply = response.data.choices[0].message.content;
            await msg.reply(reply);
            saveMessage(phone, "assistant", reply);
        } catch (error) {
            console.error('Erreur:', error.message);
        }
        return;
    }
    
    // Pas en absence → pas de réponse
    if (!isBotActive()) {
        console.log(`⏰ Heure de présence (${getCurrentHour()}h) - pas de réponse`);
        return;
    }
    
    // Mode absence: l'assistant répond
    const history = await getConversationHistory(phone, 5);
    const historyText = history.map(h => `${h.role === 'user' ? senderName : BOT_NAME}: ${h.content}`).join('\n');
    const localTime = getLocalTime();
    const currentHour = getCurrentHour();
    const isDayTime = currentHour >= 6 && currentHour < 18;
    
    const profileText = `
🌍 INFORMATIONS SUR MALKYM (RÉPONDS EN UTILISANT CES FAITS):
- Pays d'origine: ${MY_COUNTRY} (ATTENTION: il n'est PAS français, il est centrafricain)
- Ville: ${MY_CITY}
- Fuseau horaire: GMT+1
- Heure locale actuelle: ${localTime} (${isDayTime ? "journée ☀️" : "soir/nuit 🌙"})

📋 PROFIL:
- Prénom: ${MY_PROFILE.name}
- Métier: ${MY_PROFILE.job}
- Passions: ${MY_PROFILE.passions.join(", ")}
- Personnalité: ${MY_PROFILE.personality}
- Langues: ${MY_PROFILE.languages.join(", ")}
- Disponibilité: ${MY_PROFILE.schedule}

🚫 À NE JAMAIS DIVULGUER: ${MY_PROFILE.notToShare.join(", ")}
`;
    
    const systemPrompt = `${getGreeting()} ${senderName} ! ${getRandomEmoji()} Je suis ${BOT_NAME}, l'assistant personnel de ${MY_NAME}.

${profileText}

📜 HISTORIQUE RÉCENT:
${historyText || "Aucun historique"}

💬 DERNIER MESSAGE DE ${senderName.toUpperCase()}: "${msg.body}"

📋 RÈGLES STRICTES POUR TA RÉPONSE:
1. Commence par saluer avec le prénom "${senderName}"
2. Utilise 2-3 émoticônes maximum
3. Si on te demande d'où vient Malkym, réponds "${MY_COUNTRY}" (pas France)
4. Utilise l'heure locale (${localTime}) si pertinent
5. Sois concis (2-3 phrases courtes)
6. Si la question est urgente, propose de transmettre à ${MY_NAME}
7. Termine par une formule positive`;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions',
            { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: systemPrompt }], max_tokens: 600, temperature: 0.8 },
            { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
        );
        const reply = response.data.choices[0].message.content;
        await msg.reply(reply);
        saveMessage(phone, "assistant", reply);
        console.log(`✅ Réponse envoyée à ${senderName}`);
    } catch (error) {
        console.error('Erreur API:', error.response?.data?.error?.message);
        const fallback = `${getGreeting()} ${senderName} ! 😊 Je suis l'assistant de ${MY_NAME} (Centrafrique). ${MY_NAME} te répondra dès son retour. 🌟`;
        await msg.reply(fallback);
    }
});

client.initialize();

process.on('SIGINT', () => { client.destroy(); process.exit(0); });