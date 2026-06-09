/**
 * Gestion centralisée de la configuration
 * Valide les variables d'environnement et fournit des defaults
 */

require('dotenv').config();

const config = {
    // API Groq
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        maxTokens: parseInt(process.env.GROQ_MAX_TOKENS) || 600,
        temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.8,
        timeout: parseInt(process.env.GROQ_TIMEOUT) || 30000,
    },

    // Informations personnelles
    user: {
        name: process.env.MY_NAME || 'Malkym',
        phone: process.env.MY_PHONE || '23675835276',
        urgentPhone: process.env.URGENT_PHONE || process.env.MY_ALT_PHONE || process.env.MY_PHONE || '23675835276',
        country: process.env.MY_COUNTRY || 'Centrafrique',
        city: process.env.MY_CITY || 'Bangui',
        timezone: process.env.MY_TIMEZONE || 'Africa/Bangui',
    },

    // Bot
    bot: {
        name: process.env.BOT_NAME || 'MalkymBot',
        absenceStart: process.env.ABSENCE_START || '20:00',
        absenceEnd: process.env.ABSENCE_END || '08:00',
        demoMode: process.env.DEMO_MODE === 'true',
    },

    // Database
    database: {
        path: process.env.DB_PATH || './conversations.db',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || './logs',
    },

    // Rate Limiting
    rateLimit: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        perUser: parseInt(process.env.RATE_LIMIT_PER_USER) || 10,
        window: parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000, // 1 heure
    },

    // Recherche web optionnelle
    webSearch: {
        enabled: process.env.WEB_SEARCH_ENABLED === 'true',
        provider: process.env.WEB_SEARCH_PROVIDER || 'duckduckgo',
        mode: process.env.WEB_SEARCH_MODE || 'auto',
        braveApiKey: process.env.BRAVE_SEARCH_API_KEY,
        maxResults: parseInt(process.env.WEB_SEARCH_MAX_RESULTS) || 3,
    },

    // Lecture/analyse des medias WhatsApp
    media: {
        transcriptionEnabled: process.env.MEDIA_TRANSCRIPTION_ENABLED !== 'false',
        visionEnabled: process.env.MEDIA_VISION_ENABLED !== 'false',
        transcriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
        visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        maxBytes: parseInt(process.env.MEDIA_MAX_BYTES) || 20 * 1024 * 1024,
    },

    // Dashboard local
    dashboard: {
        enabled: process.env.DASHBOARD_ENABLED !== 'false',
        host: process.env.DASHBOARD_HOST || '127.0.0.1',
        port: parseInt(process.env.DASHBOARD_PORT) || 3050,
        token: process.env.DASHBOARD_TOKEN || '',
    },

    // Environment
    environment: process.env.NODE_ENV || 'development',
};

/**
 * Valide la configuration
 */
function validateConfig() {
    const errors = [];

    if (!config.groq.apiKey) {
        errors.push('❌ GROQ_API_KEY manquante - configuration impossible');
    }

    if (!config.user.phone || !/^\d+$/.test(config.user.phone)) {
        errors.push('❌ MY_PHONE invalide - doit être un numéro');
    }

    if (!config.user.timezone) {
        errors.push('❌ MY_TIMEZONE manquante');
    }

    // Validation formats horaires
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(config.bot.absenceStart)) {
        errors.push('❌ ABSENCE_START format invalide (HH:MM)');
    }
    if (!timeRegex.test(config.bot.absenceEnd)) {
        errors.push('❌ ABSENCE_END format invalide (HH:MM)');
    }

    if (errors.length > 0) {
        console.error('\n' + errors.join('\n'));
        process.exit(1);
    }
}

/**
 * Affiche la configuration au démarrage
 */
function printConfig() {
    console.log('\n📋 Configuration chargée:');
    console.log(`   🤖 Bot: ${config.bot.name}`);
    console.log(`   👤 Utilisateur: ${config.user.name} (${config.user.phone})`);
    console.log(`   📍 Localisation: ${config.user.city}, ${config.user.country}`);
    console.log(`   🕐 Fuseau horaire: ${config.user.timezone}`);
    console.log(`   ⏰ Absence: ${config.bot.absenceStart} → ${config.bot.absenceEnd}`);
    console.log(`   🔧 Environnement: ${config.environment}`);
    if (config.bot.demoMode) console.log(`   ⚠️ MODE DÉMO ACTIF`);
    console.log('');
}

// Validation au chargement
validateConfig();

module.exports = {
    config,
    validateConfig,
    printConfig,
};
