/**
 * WhatsApp Groq Bot - Version Pro
 * Fusion optimisée de bot.js et bot-avance.js avec toutes les améliorations
 * 
 * Fonctionnalités:
 * ✅ Gestion centralisée de la configuration
 * ✅ Logging structuré
 * ✅ Rate limiting
 * ✅ Reconnexion automatique
 * ✅ Gestion d'erreurs complète
 * ✅ Sanitization des messages
 * ✅ Base de données sécurisée
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { config, printConfig } = require('./src/config');
const logger = require('./src/logger');
const db = require('./src/database');
const rateLimiter = require('./src/rateLimiter');
const services = require('./src/services');
const statuses = require('./src/statuses');
const dashboard = require('./src/dashboard');

let client = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

async function notifyOwnerIfUrgent(phone, senderName, messageBody) {
    if (!services.isUrgentMessage(messageBody)) return;

    const targetPhone = config.user.urgentPhone || config.user.phone;
    if (!targetPhone) return;

    try {
        const urgentMessage = [
            `🚨 Message urgent reçu de ${senderName} (${phone})`,
            '',
            services.sanitizeMessage(messageBody),
        ].join('\n');

        await client.sendMessage(`${targetPhone}@c.us`, urgentMessage);
        logger.info(`🚨 Urgence transmise à ${targetPhone} pour ${senderName}`);
    } catch (error) {
        logger.error('Erreur transmission urgence', { error: error.message });
    }
}

async function extractMediaContext(msg, phone, senderName) {
    if (!msg.hasMedia) {
        return { context: '', text: '' };
    }

    try {
        const media = await msg.downloadMedia();
        const caption = services.sanitizeMessage(msg.body || '');
        const mediaInfo = {
            mediaType: msg.type,
            mimetype: media?.mimetype,
            filename: media?.filename,
            caption,
            size: media?.data ? Buffer.byteLength(media.data, 'base64') : null,
        };

        await db.saveMediaMessage(phone, senderName, mediaInfo);
        const analysis = await services.analyzeMedia(media, msg.type, caption);

        const labelByType = {
            image: 'image',
            video: 'video',
            audio: 'audio',
            ptt: 'message vocal',
            document: 'document',
            sticker: 'sticker',
        };

        const context = [
            `Type: ${labelByType[msg.type] || msg.type || 'media'}`,
            mediaInfo.mimetype ? `Format: ${mediaInfo.mimetype}` : null,
            mediaInfo.filename ? `Fichier: ${mediaInfo.filename}` : null,
            mediaInfo.caption ? `Legende: ${mediaInfo.caption}` : null,
            analysis.summary ? `Analyse: ${analysis.summary}` : null,
        ].filter(Boolean).join('\n');

        return {
            context,
            text: analysis.textForConversation || caption || context,
        };
    } catch (error) {
        logger.error('Erreur lecture media', { error: error.message });
        return {
            context: `Media recu, mais impossible de le lire correctement: ${error.message}`,
            text: services.sanitizeMessage(msg.body || '[media recu]'),
        };
    }
}

/**
 * Initialise le client WhatsApp
 */
function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        },
    });

    // QR Code à scanner
    client.on('qr', (qr) => {
        logger.info('📱 QR Code généré - Scanne avec WhatsApp');
        qrcode.generate(qr, { small: true });
    });

    // Authentification réussie
    client.on('authenticated', () => {
        logger.info('✅ Authentification réussie');
        reconnectAttempts = 0;
    });

    // Bot prêt
    client.on('ready', () => {
        logger.info(`✅ ${config.bot.name} connecté et prêt !`);
        logger.info(`📍 Localisation: ${config.user.city}, ${config.user.country}`);
        logger.info(`🕐 Heure locale: ${services.getLocalTime()}`);
        logger.info(`⏰ Plage d'absence: ${config.bot.absenceStart} → ${config.bot.absenceEnd}`);
        logger.info(`🤖 Statut: ${services.isBotActive() ? '🔴 ABSENT (bot actif)' : '🟢 PRÉSENT (bot inactif)'}`);
        if (config.bot.demoMode) logger.warn('⚠️ MODE DÉMO ACTIF - le bot répond toujours');
    });

    // Gestion des erreurs de connexion
    client.on('disconnected', (reason) => {
        logger.warn(`⚠️ Déconnexion: ${reason}`);
        handleReconnect();
    });

    client.on('auth_failure', (message) => {
        logger.error(`❌ Erreur d'authentification: ${message}`);
        handleReconnect();
    });

    // Traitement des messages
    client.on('message', async (msg) => {
        try {
            await handleMessage(msg);
        } catch (error) {
            logger.exception(error, 'Erreur traitement message');
        }
    });

    // Gestion des erreurs globales
    client.on('error', (error) => {
        logger.exception(error, 'Erreur client WhatsApp');
        handleReconnect();
    });

    client.on('change_state', (state) => {
        logger.debug(`📊 Changement d'état: ${state}`);
    });
}

/**
 * Gère la reconnexion automatique
 */
function handleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error(`❌ Reconnexion échouée après ${MAX_RECONNECT_ATTEMPTS} tentatives`);
        process.exit(1);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    logger.warn(`🔄 Reconnexion tentative ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} dans ${delay}ms...`);

    setTimeout(() => {
        if (client) {
            client.initialize();
        }
    }, delay);
}

/**
 * Traite un message entrant
 */
async function handleMessage(msg) {
    // Filtrer les messages non pertinents
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    if (msg.type === 'notification_template' || msg.type === 'e2e_notification') return;

    // Ignorer les messages de groupe par défaut
    const isGroup = msg.from.includes('@g.us');
    if (isGroup) {
        logger.debug('📢 Message de groupe ignoré');
        return;
    }

    // Extraire les infos
    const phone = msg.from.replace('@c.us', '');
    const isOwner = phone === config.user.phone;

    // Récupérer le nom du contact
    let senderName = 'ami';
    try {
        const contact = await msg.getContact();
        senderName = contact.pushname || contact.id.user.split('@')[0] || 'ami';
        await db.saveUserProfile(phone, senderName);
    } catch (error) {
        logger.debug(`Impossible de récupérer le nom du contact: ${error.message}`);
    }

    // Message vide sans média
    if ((!msg.body || msg.body.trim() === '') && !msg.hasMedia) {
        return;
    }

    const mediaResult = await extractMediaContext(msg, phone, senderName);
    const mediaContext = mediaResult.context;
    const incomingText = services.sanitizeMessage(mediaResult.text || msg.body || mediaContext || '[media recu]');
    const messagePreview = incomingText.substring(0, 50);
    logger.message(senderName, config.user.name, messagePreview);

    let history = [];
    if (!isOwner) {
        history = await db.getConversationHistory(phone, 5);
    }

    // Enregistrer le message
    try {
        await db.saveMessage(phone, 'user', incomingText);
        if (!isOwner) {
            await db.updateContactMemory(phone, senderName, incomingText);
        }
    } catch (error) {
        logger.error('Erreur sauvegarde message', { error: error.message });
    }

    // ========== PROPRIÉTAIRE ==========
    if (isOwner) {
        logger.info(`👤 Réponse au propriétaire: "${messagePreview}"`);
        try {
            const response = await services.generateOwnerResponse(incomingText);
            await msg.reply(response);
            await db.saveMessage(phone, 'assistant', response);
            logger.info(`✅ Réponse envoyée au propriétaire`);
        } catch (error) {
            logger.exception(error, 'Erreur génération réponse propriétaire');
            await msg.reply('⚠️ Erreur technique - impossible de générer une réponse.');
        }
        return;
    }

    // ========== VÉRIFIER LE RATE LIMITING ==========
    const rateLimitCheck = rateLimiter.checkLimit(phone);
    if (!rateLimitCheck.allowed) {
        logger.warn(`⏱️ Rate limit dépassé pour ${senderName} - pas de réponse`);
        return;
    }

    await notifyOwnerIfUrgent(phone, senderName, incomingText);

    const shouldGreet = services.shouldGreetConversation(history);
    const contactMemory = await db.getContactMemory(phone);
    const webSearch = services.needsWebSearch(incomingText)
        ? await services.performWebSearch(incomingText)
        : null;

    // ========== VÉRIFIER SI LE BOT EST EN ABSENCE ==========
    if (!services.isBotActive()) {
        // PAS EN ABSENCE = Envoyer le message du statut actuel
        const currentStatus = statuses.getStatus();
        logger.info(`📍 Statut: ${currentStatus.label} (${services.getCurrentHour()}h) - réponse du statut`);
        
        try {
            // Message professionnel et concis
            const statusMessage = shouldGreet
                ? `${services.getTimeBasedGreeting()} ${senderName}! 👋\n\n🤖 Je suis ${config.bot.name}, assistant IA de ${config.user.name}.\n\n${currentStatus.message}\n\n${services.getEmergencyInstructions()}`
                : `${currentStatus.message}\n\nTu peux me laisser ton message ici, je le garde pour ${config.user.name}.`;
            await msg.reply(statusMessage);
            await db.saveMessage(phone, 'assistant', statusMessage);
            logger.info(`✅ Message de statut envoyé à ${senderName}`);
        } catch (error) {
            logger.error('Erreur envoi message de statut', { error: error.message });
        }
        return;
    }

    // ========== MODE ABSENCE ==========
    logger.info(`🤖 Mode absence - réponse IA à ${senderName}`);

    try {
        // Générer la réponse
        const currentStatus = statuses.getStatus();
        const response = await services.generateAbsenceResponse(senderName, incomingText, history, {
            shouldGreet,
            status: currentStatus,
            contactMemory,
            mediaContext,
            webSearch,
        });

        // Envoyer
        await msg.reply(response);
        await db.saveMessage(phone, 'assistant', response);

        logger.info(`✅ Réponse envoyée à ${senderName}`);

    } catch (error) {
        logger.exception(error, `Erreur génération réponse pour ${senderName}`);

        // Message de fallback professionnel
        const fallback = shouldGreet
            ? `${services.getTimeBasedGreeting()} ${senderName}! 👋\n\n🤖 Je suis ${config.bot.name}, assistant IA de ${config.user.name}.\n\n${config.user.name} est actuellement absent.\n\n${services.getEmergencyInstructions()}`
            : `Je n'ai pas pu générer une réponse. ${config.user.name} te répondra dès son retour.`;
        try {
            await msg.reply(fallback);
        } catch (err) {
            logger.error('Erreur envoi message fallback', { error: err.message });
        }
    }
}

/**
 * Startup du bot
 */
async function startup() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   🤖 WhatsApp Groq Bot - Pro v2.0     ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        // Charger la config
        printConfig();

        // Initialiser la base de données
        logger.info('📦 Initialisation de la base de données...');
        await db.initialize();

        // Dashboard local
        dashboard.startDashboard();

        // Initialiser le client
        logger.info('🔌 Connexion à WhatsApp...');
        initializeClient();
        await client.initialize();

    } catch (error) {
        logger.exception(error, 'Erreur lors du démarrage');
        process.exit(1);
    }
}

/**
 * Shutdown gracieux
 */
async function shutdown(signal) {
    logger.info(`\n🛑 Signal reçu: ${signal}`);
    logger.info('Arrêt du bot...');

    try {
        if (client) {
            await client.destroy();
            logger.info('✅ Client WhatsApp fermé');
        }

        await dashboard.stopDashboard();
        logger.info('✅ Dashboard fermé');

        await db.close();
        logger.info('✅ Base de données fermée');

        logger.info('✅ Bot arrêté avec succès');
        process.exit(0);

    } catch (error) {
        logger.exception(error, 'Erreur lors de l\'arrêt');
        process.exit(1);
    }
}

// Gestion des signaux
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promise rejection non gérée', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
    logger.exception(error, 'Exception non gérée');
    process.exit(1);
});

// Démarrer le bot
startup().catch(error => {
    logger.exception(error, 'Erreur startup');
    process.exit(1);
});

module.exports = { client };
