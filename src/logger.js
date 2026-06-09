/**
 * Système de logging structuré
 * Logs en console et dans des fichiers
 */

const fs = require('fs');
const path = require('path');
const { config } = require('./config');

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(config.logging.dir)) {
    fs.mkdirSync(config.logging.dir, { recursive: true });
}

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const LEVEL_COLORS = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m',  // Yellow
    info: '\x1b[36m',  // Cyan
    debug: '\x1b[35m', // Magenta
    reset: '\x1b[0m',
};

const currentLevel = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;

/**
 * Formate un message de log
 */
function formatLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
        logMessage += ` | ${JSON.stringify(data)}`;
    }

    return logMessage;
}

/**
 * Écrit dans un fichier de log
 */
function writeToFile(level, message, data = null) {
    try {
        const fileName = path.join(config.logging.dir, `${level}.log`);
        const logMessage = formatLog(level, message, data) + '\n';
        fs.appendFileSync(fileName, logMessage);
    } catch (err) {
        console.error('❌ Erreur écriture log:', err.message);
    }
}

/**
 * Affiche dans la console avec couleur
 */
function printToConsole(level, message, data = null) {
    const color = LEVEL_COLORS[level];
    const reset = LEVEL_COLORS.reset;
    const timestamp = new Date().toLocaleTimeString('fr-FR');

    let output = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
    if (data && config.logging.level === 'debug') {
        output += ` | ${JSON.stringify(data)}`;
    }

    console.log(output);
}

/**
 * Log générique
 */
function log(level, message, data = null) {
    if (LOG_LEVELS[level] <= currentLevel) {
        printToConsole(level, message, data);
        writeToFile(level, message, data);
    }
}

const logger = {
    error: (message, data) => log('error', message, data),
    warn: (message, data) => log('warn', message, data),
    info: (message, data) => log('info', message, data),
    debug: (message, data) => log('debug', message, data),

    /**
     * Log les requêtes API
     */
    api: (method, url, status, duration) => {
        const message = `${method} ${url} → ${status} (${duration}ms)`;
        log('debug', message);
    },

    /**
     * Log les messages WhatsApp
     */
    message: (from, to, preview, status = '📨') => {
        log('info', `${status} ${from} → ${to.substring(0, 15)}...`);
    },

    /**
     * Log les erreurs avec contexte
     */
    exception: (error, context = '') => {
        const message = context ? `${context} - ${error.message}` : error.message;
        writeToFile('error', message, { stack: error.stack });
        printToConsole('error', `❌ ${message}`);
    },
};

module.exports = logger;
