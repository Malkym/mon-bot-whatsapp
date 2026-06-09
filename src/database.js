/**
 * Wrapper pour SQLite3 avec gestion d'erreurs
 * Permet les migrations et les requêtes sécurisées
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');
const { config } = require('./config');

let db = null;

/**
 * Initialise la connexion à la base de données
 */
function initialize() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(config.database.path, (err) => {
            if (err) {
                logger.error('Erreur connexion DB', { error: err.message });
                reject(err);
            } else {
                logger.info(`✅ Base de données connectée: ${config.database.path}`);
                createTables().then(resolve).catch(reject);
            }
        });

        db.configure('busyTimeout', 5000);
    });
}

/**
 * Crée les tables si elles n'existent pas
 */
async function createTables() {
    // Créer les tables
    const tableQueries = [
        `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS user_profiles (
            phone TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            interests TEXT,
            last_seen DATETIME,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            message_count INTEGER DEFAULT 0
        )`,

        `CREATE TABLE IF NOT EXISTS api_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            status INTEGER NOT NULL,
            duration INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS contact_memory (
            phone TEXT PRIMARY KEY,
            name TEXT,
            notes TEXT,
            last_summary TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS media_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            sender_name TEXT,
            media_type TEXT,
            mimetype TEXT,
            filename TEXT,
            caption TEXT,
            size INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    ];

    // Créer les tables
    for (const query of tableQueries) {
        await run(query);
    }

    // Créer les indexes séparément (SQLite3 n'aime pas les INDEX dans CREATE TABLE)
    const indexQueries = [
        `CREATE INDEX IF NOT EXISTS idx_messages_phone_timestamp ON messages(phone, timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_media_phone_timestamp ON media_messages(phone, timestamp)`,
    ];

    for (const query of indexQueries) {
        try {
            await run(query);
        } catch (err) {
            // Les indexes peuvent déjà exister, on ignore les erreurs
            if (!err.message.includes('already exists')) {
                logger.debug('Index creation', { error: err.message });
            }
        }
    }
}

/**
 * Exécute une requête sans retour
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                logger.error('Erreur DB run', { sql: sql.substring(0, 50), error: err.message });
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

/**
 * Récupère une ligne
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                logger.error('Erreur DB get', { sql: sql.substring(0, 50), error: err.message });
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

/**
 * Récupère toutes les lignes
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                logger.error('Erreur DB all', { sql: sql.substring(0, 50), error: err.message });
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Sauvegarde un message
 */
async function saveMessage(phone, role, content) {
    try {
        await run(
            'INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)',
            [phone, role, content]
        );
        
        // Incrémenter le compteur du profil
        await run(
            'UPDATE user_profiles SET message_count = message_count + 1 WHERE phone = ?',
            [phone]
        );
    } catch (err) {
        logger.error('Erreur saveMessage', { phone, error: err.message });
    }
}

/**
 * Sauvegarde les métadonnées d'un média reçu.
 */
async function saveMediaMessage(phone, senderName, mediaInfo = {}) {
    try {
        await run(
            `INSERT INTO media_messages 
             (phone, sender_name, media_type, mimetype, filename, caption, size) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                phone,
                senderName,
                mediaInfo.mediaType || null,
                mediaInfo.mimetype || null,
                mediaInfo.filename || null,
                mediaInfo.caption || null,
                mediaInfo.size || null,
            ]
        );
    } catch (err) {
        logger.error('Erreur saveMediaMessage', { phone, error: err.message });
    }
}

function extractMemoryFacts(message) {
    if (!message || typeof message !== 'string') return [];

    const clean = message.trim().replace(/\s+/g, ' ');
    const lower = clean.toLowerCase();
    const facts = [];

    const patterns = [
        { label: 'Nom', regex: /\b(?:je m'appelle|moi c'est|mon nom est)\s+([^,.!?]+)/i },
        { label: 'Ville', regex: /\b(?:j'habite|je vis|je suis a|je suis à)\s+([^,.!?]+)/i },
        { label: 'Travail', regex: /\b(?:je travaille|mon travail|je suis)\s+(?:comme|dans|en tant que)?\s*([^,.!?]+)/i },
        { label: 'Besoin', regex: /\b(?:j'ai besoin de|je cherche|je veux)\s+([^,.!?]+)/i },
        { label: 'Preference', regex: /\b(?:je prefere|je préfère|j'aime)\s+([^,.!?]+)/i },
    ];

    for (const pattern of patterns) {
        const match = clean.match(pattern.regex);
        if (match && match[1] && match[1].trim().length >= 3) {
            facts.push(`${pattern.label}: ${match[1].trim()}`);
        }
    }

    if (lower.includes('urgent') || lower.includes('urgence')) {
        facts.push('A deja mentionne une urgence');
    }

    return facts.slice(0, 5);
}

/**
 * Ajoute des faits simples et persistants sur un contact.
 */
async function updateContactMemory(phone, name, message) {
    const facts = extractMemoryFacts(message);
    if (!facts.length) return null;

    try {
        const existing = await getContactMemory(phone);
        const existingNotes = existing?.notes
            ? existing.notes.split('\n').map(note => note.trim()).filter(Boolean)
            : [];

        const merged = [...existingNotes];
        for (const fact of facts) {
            if (!merged.some(note => note.toLowerCase() === fact.toLowerCase())) {
                merged.push(fact);
            }
        }

        const notes = merged.slice(-20).join('\n');
        await run(
            `INSERT INTO contact_memory (phone, name, notes, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(phone) DO UPDATE SET
                name = excluded.name,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP`,
            [phone, name, notes]
        );

        return { phone, name, notes };
    } catch (err) {
        logger.error('Erreur updateContactMemory', { phone, error: err.message });
        return null;
    }
}

/**
 * Récupère l'historique de conversation
 */
async function getConversationHistory(phone, limit = 10) {
    try {
        const messages = await all(
            `SELECT role, content, timestamp FROM messages 
             WHERE phone = ? 
             ORDER BY timestamp DESC 
             LIMIT ?`,
            [phone, limit]
        );
        return messages.reverse();
    } catch (err) {
        logger.error('Erreur getConversationHistory', { phone, error: err.message });
        return [];
    }
}

async function getContactMemory(phone) {
    try {
        return await get(
            'SELECT * FROM contact_memory WHERE phone = ?',
            [phone]
        );
    } catch (err) {
        logger.error('Erreur getContactMemory', { phone, error: err.message });
        return null;
    }
}

async function getRecentMessages(limit = 50) {
    try {
        return await all(
            `SELECT phone, role, content, timestamp
             FROM messages
             ORDER BY timestamp DESC
             LIMIT ?`,
            [limit]
        );
    } catch (err) {
        logger.error('Erreur getRecentMessages', { error: err.message });
        return [];
    }
}

async function getDashboardStats() {
    try {
        const messageStats = await get(
            `SELECT
                COUNT(*) AS total_messages,
                COUNT(DISTINCT phone) AS total_contacts,
                SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS bot_messages,
                SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_messages
             FROM messages`
        );
        const mediaStats = await get('SELECT COUNT(*) AS total_media FROM media_messages');
        const apiStats = await get(
            `SELECT COUNT(*) AS total_api_calls, AVG(duration) AS avg_api_duration
             FROM api_logs`
        );

        return {
            totalMessages: messageStats?.total_messages || 0,
            totalContacts: messageStats?.total_contacts || 0,
            botMessages: messageStats?.bot_messages || 0,
            userMessages: messageStats?.user_messages || 0,
            totalMedia: mediaStats?.total_media || 0,
            totalApiCalls: apiStats?.total_api_calls || 0,
            avgApiDuration: Math.round(apiStats?.avg_api_duration || 0),
        };
    } catch (err) {
        logger.error('Erreur getDashboardStats', { error: err.message });
        return {};
    }
}

async function getContactsOverview(limit = 50) {
    try {
        return await all(
            `SELECT
                up.phone,
                up.name,
                up.last_seen,
                up.message_count,
                cm.notes,
                MAX(m.timestamp) AS last_message_at
             FROM user_profiles up
             LEFT JOIN contact_memory cm ON cm.phone = up.phone
             LEFT JOIN messages m ON m.phone = up.phone
             GROUP BY up.phone
             ORDER BY last_message_at DESC
             LIMIT ?`,
            [limit]
        );
    } catch (err) {
        logger.error('Erreur getContactsOverview', { error: err.message });
        return [];
    }
}

/**
 * Sauvegarde/met à jour le profil utilisateur
 */
async function saveUserProfile(phone, name, interests = null) {
    try {
        await run(
            `INSERT INTO user_profiles (phone, name, interests, last_seen)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(phone) DO UPDATE SET
                name = excluded.name,
                interests = COALESCE(excluded.interests, user_profiles.interests),
                last_seen = excluded.last_seen`,
            [phone, name, interests, new Date().toISOString()]
        );
    } catch (err) {
        logger.error('Erreur saveUserProfile', { phone, error: err.message });
    }
}

/**
 * Récupère le profil utilisateur
 */
async function getUserProfile(phone) {
    try {
        return await get(
            'SELECT * FROM user_profiles WHERE phone = ?',
            [phone]
        );
    } catch (err) {
        logger.error('Erreur getUserProfile', { phone, error: err.message });
        return null;
    }
}

/**
 * Enregistre une requête API
 */
async function logApiCall(method, endpoint, status, duration) {
    try {
        await run(
            `INSERT INTO api_logs (method, endpoint, status, duration) 
             VALUES (?, ?, ?, ?)`,
            [method, endpoint, status, duration]
        );
    } catch (err) {
        logger.debug('Erreur logApiCall', { error: err.message });
    }
}

/**
 * Ferme la base de données
 */
async function close() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    logger.error('Erreur fermeture DB', { error: err.message });
                    reject(err);
                } else {
                    logger.info('✅ Base de données fermée');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    initialize,
    saveMessage,
    saveMediaMessage,
    getConversationHistory,
    getContactMemory,
    updateContactMemory,
    getRecentMessages,
    getDashboardStats,
    getContactsOverview,
    saveUserProfile,
    getUserProfile,
    logApiCall,
    close,
    run,
    get,
    all,
};
