/**
 * Rate Limiter pour éviter le spam et les abus
 * Utilise une approche Token Bucket
 */

const { config } = require('./config');
const logger = require('./logger');

const userBuckets = new Map();

/**
 * Initialise un bucket pour un utilisateur
 */
function initBucket(userId) {
    return {
        tokens: config.rateLimit.perUser,
        lastRefill: Date.now(),
    };
}

/**
 * Recharge les tokens en fonction du temps écoulé
 */
function refillBucket(bucket) {
    const now = Date.now();
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = (timeElapsed / config.rateLimit.window) * config.rateLimit.perUser;

    bucket.tokens = Math.min(config.rateLimit.perUser, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket;
}

/**
 * Vérifie si l'utilisateur peut faire une requête
 */
function checkLimit(userId) {
    if (!config.rateLimit.enabled) {
        return { allowed: true, remaining: -1 };
    }

    if (!userBuckets.has(userId)) {
        userBuckets.set(userId, initBucket(userId));
    }

    let bucket = userBuckets.get(userId);
    bucket = refillBucket(bucket);

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        logger.debug(`✅ Requête acceptée pour ${userId} (${Math.floor(bucket.tokens)} tokens restants)`);
        return { allowed: true, remaining: Math.floor(bucket.tokens) };
    } else {
        logger.warn(`⚠️ Rate limit dépassé pour ${userId}`);
        return { allowed: false, remaining: 0, resetIn: config.rateLimit.window };
    }
}

/**
 * Réinitialise le bucket d'un utilisateur
 */
function reset(userId) {
    userBuckets.delete(userId);
    logger.debug(`🔄 Rate limit réinitialisé pour ${userId}`);
}

/**
 * Récupère les statistiques de rate limiting
 */
function getStats(userId) {
    if (!userBuckets.has(userId)) {
        return null;
    }

    const bucket = userBuckets.get(userId);
    return {
        tokens: Math.floor(bucket.tokens),
        maxTokens: config.rateLimit.perUser,
        windowMs: config.rateLimit.window,
    };
}

/**
 * Nettoie les anciens buckets (housekeeping)
 */
function cleanup() {
    const now = Date.now();
    const maxAge = config.rateLimit.window * 2;

    for (const [userId, bucket] of userBuckets.entries()) {
        if (now - bucket.lastRefill > maxAge) {
            userBuckets.delete(userId);
        }
    }
}

// Nettoie les buckets toutes les heures sans bloquer l'arret des tests/scripts.
const cleanupTimer = setInterval(cleanup, 3600000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
    checkLimit,
    reset,
    getStats,
    cleanup,
};
