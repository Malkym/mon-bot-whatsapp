/**
 * Gestion des statuts et messages personnalisés
 * Messages différents selon l'heure, le jour et l'activité
 */

const { config } = require('./config');

/**
 * Détermine le statut actuel (travail, repos, sommeil, église, etc)
 */
function getCurrentStatus() {
    const now = new Date();
    
    // Obtenir le jour de la semaine (0=dimanche, 1=lundi, etc)
    const dayOfWeek = now.getDay();
    
    // Obtenir l'heure locale
    const formatter = new Intl.DateTimeFormat('fr-FR', {
        timeZone: config.user.timezone,
        hour: '2-digit',
        hour12: false,
    });
    const hour = parseInt(formatter.format(now));

    // DIMANCHE = église
    if (dayOfWeek === 0) {
        if (hour >= 8 && hour < 12) {
            return {
                status: 'church',
                label: '⛪ À l\'église',
                message: `${config.user.name} est à l'église en ce moment. Il répondra dès son retour.`,
            };
        } else if (hour >= 12 && hour < 18) {
            return {
                status: 'family',
                label: '👨‍👩‍👧 Temps en famille',
                message: `${config.user.name} profite du dimanche en famille. Il répondra plus tard.`,
            };
        }
    }

    // LUNDI-SAMEDI
    // Travail: 08:00 - 18:00
    if (hour >= 8 && hour < 12) {
        return {
            status: 'work',
            label: '💼 Au travail',
            message: `${config.user.name} est occupé par le travail. Il répondra dès que possible.`,
        };
    }

    if (hour >= 12 && hour < 14) {
        return {
            status: 'lunch',
            label: '🍽️ À table',
            message: `${config.user.name} est en train de déjeuner. Il répondra dès que possible.`,
        };
    }

    if (hour >= 14 && hour < 18) {
        return {
            status: 'work',
            label: '💼 Au travail',
            message: `${config.user.name} est occupé par le travail. Il répondra dès que possible.`,
        };
    }

    // Repos: 18:00 - 22:00
    if (hour >= 18 && hour < 22) {
        return {
            status: 'rest',
            label: '🌅 Temps libre',
            message: `${config.user.name} se repose un peu. Il reviendra bientôt.`,
        };
    }

    // Sommeil: 22:00 - 08:00
    return {
        status: 'sleep',
        label: '😴 Je dors',
        message: `${config.user.name} est en train de dormir. Il répondra demain matin.`,
    };
}

/**
 * Obtient le message personnalisé pour le statut actuel
 */
function getStatusMessage() {
    const status = getCurrentStatus();
    return status.message;
}

/**
 * Obtient le label du statut actuel (pour les logs)
 */
function getStatusLabel() {
    const status = getCurrentStatus();
    return status.label;
}

/**
 * Obtient l'objet statut complet
 */
function getStatus() {
    return getCurrentStatus();
}

module.exports = {
    getCurrentStatus,
    getStatusMessage,
    getStatusLabel,
    getStatus,
};
