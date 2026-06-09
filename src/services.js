/**
 * Services métier pour la logique IA et interactions
 */

const axios = require('axios');
const FormData = require('form-data');
const { config } = require('./config');
const logger = require('./logger');
const db = require('./database');
const { MY_PROFILE } = require('../profile');

const GREETING_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Sanitise un message pour éviter les injections
 */
function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') return '';

    return message
        .slice(0, 4096) // Limiter la longueur
        .trim()
        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Supprimer les scripts
        .replace(/<[^>]*>/g, '') // Supprimer toutes les balises HTML
        .replace(/[<>]/g, '') // Éviter HTML/XML injections restantes
        .replace(/\n{3,}/g, '\n\n'); // Limiter les sauts de ligne
}

/**
 * Appelle l'API Groq avec retry
 */
async function callGroqAPI(messages, maxRetries = 3) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: config.groq.model,
                    messages: messages,
                    max_tokens: config.groq.maxTokens,
                    temperature: config.groq.temperature,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.groq.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: config.groq.timeout,
                }
            );

            const duration = Date.now() - startTime;
            await db.logApiCall('POST', '/chat/completions', 200, duration);
            logger.api('POST', '/chat/completions', 200, duration);

            return response.data.choices[0].message.content;

        } catch (error) {
            lastError = error;
            const duration = Date.now() - startTime;
            const status = error.response?.status || 0;

            logger.api('POST', '/chat/completions', status, duration);

            // Erreur temporaire → retry
            if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    logger.warn(`⚠️ Groq API erreur (tentative ${attempt}/${maxRetries}) - retry dans ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            } else {
                // Erreur client → pas de retry
                break;
            }
        }
    }

    logger.error('❌ Groq API échoué après retries', { 
        error: lastError.message, 
        status: lastError.response?.status 
    });
    throw lastError;
}

/**
 * Obtient la salutation basée sur l'heure
 */
function getTimeBasedGreeting() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('fr-FR', {
        timeZone: config.user.timezone,
        hour: '2-digit',
        hour12: false,
    });
    const hour = parseInt(formatter.format(now));

    if (hour < 12) return '🌅 Bonjour';
    if (hour < 18) return '☀️ Bon après-midi';
    return '🌙 Bonsoir';
}

/**
 * Obtient une emoji aléatoire positive
 */
function getRandomEmoji() {
    const emojis = ['😊', '😄', '🌟', '✨', '💫', '🤗', '🎯', '💪', '🔥', '⭐', '🌸', '🍀', '🎉', '💡', '🤖'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

/**
 * Calcule l'heure locale
 */
function getLocalTime() {
    const now = new Date();
    const options = {
        timeZone: config.user.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    };
    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    return formatter.format(now);
}

/**
 * Récupère l'heure actuelle (entière)
 */
function getCurrentHour() {
    const now = new Date();
    const options = {
        timeZone: config.user.timezone,
        hour: '2-digit',
        hour12: false,
    };
    const formatter = new Intl.DateTimeFormat('fr-FR', options);
    return parseInt(formatter.format(now));
}

function parseDbTimestamp(timestamp) {
    if (!timestamp) return null;
    const normalized = String(timestamp).replace(' ', 'T');
    const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Détermine si l'assistant doit rouvrir la conversation avec une salutation.
 */
function shouldGreetConversation(conversationHistory = []) {
    if (!conversationHistory.length) return true;

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const lastDate = parseDbTimestamp(lastMessage.timestamp);
    if (!lastDate) return false;

    return Date.now() - lastDate.getTime() >= GREETING_COOLDOWN_MS;
}

/**
 * Détecte les messages qui méritent une alerte directe au propriétaire.
 */
function isUrgentMessage(message) {
    const normalized = sanitizeMessage(message)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return [
        'urgent',
        'urgence',
        'important',
        'appelle',
        'appel',
        'telephone',
        'probleme grave',
        'aide moi',
        'besoin de toi',
        'rapidement',
        'vite',
        'immediat',
        'maintenant',
    ].some(keyword => normalized.includes(keyword));
}

function getEmergencyInstructions() {
    const urgentNumber = config.user.urgentPhone || config.user.phone;
    const numberLine = urgentNumber
        ? `- ☎️ Tu peux appeler ${config.user.name} directement au ${urgentNumber}`
        : `- ☎️ Tu peux appeler ${config.user.name} directement`;

    return `${numberLine}
- 💬 Tu peux aussi expliquer clairement l'urgence ici: je transmettrai le message.`;
}

function formatOwnerProfile() {
    const profile = MY_PROFILE || {};
    const location = profile.location || {};
    const privateItems = Array.isArray(profile.notToShare) ? profile.notToShare.join(', ') : 'informations sensibles';

    return `Nom: ${profile.name || config.user.name}
Metier: ${profile.job || 'Developpeur IA & Automatisation'}
Localisation: ${location.city || config.user.city}, ${location.country || config.user.country}
Fuseau horaire: ${location.timezone || config.user.timezone}
Personnalite: ${profile.personality || 'professionnel, calme et amical'}
Langues: ${(profile.languages || ['francais']).join(', ')}
Passions: ${(profile.passions || []).join(', ') || 'IA, automatisation'}
Projets: ${(profile.projects || []).join(', ') || 'assistants IA'}
Disponibilite: ${profile.schedule || 'variable selon le statut actuel'}
Ne jamais partager: ${privateItems}`;
}

function formatContactMemory(memory) {
    if (!memory || !memory.notes) return 'Aucune memoire long terme pour ce contact.';

    return memory.notes
        .split('\n')
        .map(note => `- ${note}`)
        .join('\n');
}

function needsWebSearch(message) {
    const normalized = sanitizeMessage(message)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (config.webSearch.mode === 'always') return true;
    if (!config.webSearch.enabled) return false;

    return [
        'recherche',
        'cherche sur internet',
        'sur google',
        'google',
        'internet',
        'actualite',
        'actualité',
        'news',
        'aujourd hui',
        'aujourd’hui',
        'maintenant',
        'en ce moment',
        'prix',
        'meteo',
        'météo',
        'score',
        'horaire',
        'dernier',
        'derniere',
        'recente',
        'recent',
        'president',
        'président',
        'ministre',
        'ceo',
        'directeur',
        'version',
        'disponible',
        'qui est',
        'c est quoi',
        'c’est quoi',
        'ou trouver',
        'où trouver',
    ].some(keyword => normalized.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

async function searchWithBrave(query) {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: {
            q: query,
            count: config.webSearch.maxResults,
            country: 'CF',
            search_lang: 'fr',
        },
        headers: {
            'X-Subscription-Token': config.webSearch.braveApiKey,
        },
        timeout: 10000,
    });

    return (response.data?.web?.results || []).slice(0, config.webSearch.maxResults).map(result => ({
        title: result.title,
        snippet: result.description,
        url: result.url,
    }));
}

async function searchWithDuckDuckGo(query) {
    const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
            q: query,
            format: 'json',
            no_html: 1,
            skip_disambig: 1,
        },
        timeout: 10000,
    });

    const results = [];
    if (response.data?.AbstractText) {
        results.push({
            title: response.data.Heading || query,
            snippet: response.data.AbstractText,
            url: response.data.AbstractURL,
        });
    }

    for (const topic of response.data?.RelatedTopics || []) {
        if (results.length >= config.webSearch.maxResults) break;
        if (topic.Text) {
            let title = query;
            try {
                title = topic.FirstURL ? new URL(topic.FirstURL).hostname : query;
            } catch (_) {
                title = query;
            }

            results.push({
                title,
                snippet: topic.Text,
                url: topic.FirstURL,
            });
        }
    }

    return results.slice(0, config.webSearch.maxResults);
}

function decodeHtmlEntity(entity) {
    const named = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        '#39': "'",
    };
    if (named[entity]) return named[entity];
    if (entity.startsWith('#x')) return String.fromCharCode(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCharCode(parseInt(entity.slice(1), 10));
    return `&${entity};`;
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&([^;]+);/g, (_, entity) => decodeHtmlEntity(entity))
        .replace(/\s+/g, ' ')
        .trim();
}

async function searchWithDuckDuckGoHtml(query) {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: {
            'User-Agent': `${config.bot.name}/2.0 (+local WhatsApp assistant)`,
        },
        timeout: 12000,
    });

    const html = String(response.data || '');
    const results = [];
    const resultRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = resultRegex.exec(html)) && results.length < config.webSearch.maxResults) {
        results.push({
            title: stripHtml(match[2]),
            snippet: stripHtml(match[3]),
            url: stripHtml(match[1]),
        });
    }

    return results;
}

async function performWebSearch(query) {
    if (!config.webSearch.enabled) {
        return {
            enabled: false,
            results: [],
            note: 'Recherche web desactivee. Active WEB_SEARCH_ENABLED=true pour autoriser les recherches.',
        };
    }

    try {
        const useBrave = config.webSearch.provider === 'brave' && config.webSearch.braveApiKey;
        let results = useBrave
            ? await searchWithBrave(query)
            : await searchWithDuckDuckGo(query);

        if (!useBrave && !results.length) {
            results = await searchWithDuckDuckGoHtml(query);
        }

        return {
            enabled: true,
            provider: useBrave ? 'brave' : 'duckduckgo',
            results,
        };
    } catch (error) {
        logger.error('Erreur recherche web', { error: error.message });
        return {
            enabled: true,
            results: [],
            note: `Recherche web indisponible: ${error.message}`,
        };
    }
}

function getMediaExtension(mimetype = '') {
    const subtype = mimetype.split('/')[1] || 'bin';
    return subtype.split(';')[0].replace(/[^a-z0-9.+-]/gi, '') || 'bin';
}

function isAudioMedia(mimetype = '', messageType = '') {
    return mimetype.startsWith('audio/') || ['audio', 'ptt'].includes(messageType);
}

function isImageMedia(mimetype = '', messageType = '') {
    return mimetype.startsWith('image/') || messageType === 'image';
}

async function transcribeAudioMedia(media, messageType = '') {
    if (!config.media.transcriptionEnabled) {
        return { ok: false, note: 'Transcription audio desactivee.' };
    }

    if (!media?.data || !isAudioMedia(media.mimetype || '', messageType)) {
        return { ok: false, note: 'Ce media ne ressemble pas a un audio.' };
    }

    const buffer = Buffer.from(media.data, 'base64');
    if (buffer.length > config.media.maxBytes) {
        return { ok: false, note: `Audio trop volumineux (${buffer.length} octets).` };
    }

    const form = new FormData();
    const extension = getMediaExtension(media.mimetype || 'audio/ogg');
    form.append('file', buffer, {
        filename: media.filename || `whatsapp-audio.${extension}`,
        contentType: media.mimetype || 'audio/ogg',
    });
    form.append('model', config.media.transcriptionModel);
    form.append('language', 'fr');
    form.append('response_format', 'json');

    try {
        const startTime = Date.now();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/audio/transcriptions',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${config.groq.apiKey}`,
                },
                timeout: config.groq.timeout,
                maxBodyLength: Infinity,
            }
        );

        await db.logApiCall('POST', '/audio/transcriptions', 200, Date.now() - startTime);
        return {
            ok: true,
            text: sanitizeMessage(response.data?.text || ''),
            model: config.media.transcriptionModel,
        };
    } catch (error) {
        logger.error('Erreur transcription audio', {
            error: error.response?.data?.error?.message || error.message,
            status: error.response?.status,
        });
        return {
            ok: false,
            note: `Transcription audio indisponible: ${error.response?.data?.error?.message || error.message}`,
        };
    }
}

async function analyzeImageMedia(media, prompt = '') {
    if (!config.media.visionEnabled) {
        return { ok: false, note: 'Analyse image desactivee.' };
    }

    if (!media?.data || !isImageMedia(media.mimetype || '')) {
        return { ok: false, note: 'Ce media ne ressemble pas a une image.' };
    }

    const bufferSize = Buffer.byteLength(media.data, 'base64');
    if (bufferSize > config.media.maxBytes) {
        return { ok: false, note: `Image trop volumineuse (${bufferSize} octets).` };
    }

    const userPrompt = prompt
        ? `Analyse cette image WhatsApp. Legende/message utilisateur: "${sanitizeMessage(prompt)}". Reponds en francais, clairement et prudemment.`
        : 'Analyse cette image WhatsApp. Decris ce que tu vois en francais, clairement et prudemment.';

    try {
        const startTime = Date.now();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: config.media.visionModel,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${media.mimetype || 'image/jpeg'};base64,${media.data}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: Math.min(config.groq.maxTokens, 500),
                temperature: 0.2,
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.groq.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: config.groq.timeout,
                maxBodyLength: Infinity,
            }
        );

        await db.logApiCall('POST', '/chat/completions:vision', 200, Date.now() - startTime);
        return {
            ok: true,
            text: sanitizeMessage(response.data?.choices?.[0]?.message?.content || ''),
            model: config.media.visionModel,
        };
    } catch (error) {
        logger.error('Erreur analyse image', {
            error: error.response?.data?.error?.message || error.message,
            status: error.response?.status,
        });
        return {
            ok: false,
            note: `Analyse image indisponible: ${error.response?.data?.error?.message || error.message}`,
        };
    }
}

async function analyzeMedia(media, messageType = '', caption = '') {
    if (!media?.data) return { summary: '', textForConversation: '' };

    if (isAudioMedia(media.mimetype || '', messageType)) {
        const transcription = await transcribeAudioMedia(media, messageType);
        if (transcription.ok && transcription.text) {
            return {
                summary: `Transcription vocale (${transcription.model}): "${transcription.text}"`,
                textForConversation: transcription.text,
            };
        }
        return {
            summary: transcription.note || 'Vocal recu, transcription impossible.',
            textForConversation: caption || '[vocal recu]',
        };
    }

    if (isImageMedia(media.mimetype || '', messageType)) {
        const analysis = await analyzeImageMedia(media, caption);
        if (analysis.ok && analysis.text) {
            return {
                summary: `Analyse image (${analysis.model}): ${analysis.text}`,
                textForConversation: caption ? `${caption}\n\nDescription image: ${analysis.text}` : analysis.text,
            };
        }
        return {
            summary: analysis.note || 'Image recue, analyse impossible.',
            textForConversation: caption || '[image recue]',
        };
    }

    return {
        summary: 'Media recu. Analyse automatique disponible seulement pour vocaux/audio et images.',
        textForConversation: caption || '[media recu]',
    };
}

function formatWebSearchContext(searchData) {
    if (!searchData) return 'Aucune recherche web effectuee.';
    if (!searchData.enabled) return searchData.note;
    if (!searchData.results.length) return searchData.note || 'Recherche web effectuee, mais aucun resultat fiable trouve.';

    return searchData.results.map((result, index) => {
        return `${index + 1}. ${result.title || 'Resultat'}\n   ${result.snippet || ''}\n   Source: ${result.url || 'non disponible'}`;
    }).join('\n');
}

/**
 * Vérifie si le bot doit être actif (en absence)
 */
function isBotActive() {
    if (config.bot.demoMode) return true;

    const currentHour = getCurrentHour();
    const currentMinute = new Date().getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = config.bot.absenceStart.split(':').map(Number);
    const [endHour, endMinute] = config.bot.absenceEnd.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
    } else {
        return currentTime >= startTime && currentTime < endTime;
    }
}

/**
 * Génère une réponse IA pour l'absence
 */
async function generateAbsenceResponse(senderName, userMessage, conversationHistory = [], options = {}) {
    const localTime = getLocalTime();
    const currentHour = getCurrentHour();
    const isDayTime = currentHour >= 6 && currentHour < 18;
    const shouldGreet = options.shouldGreet ?? shouldGreetConversation(conversationHistory);
    const status = options.status || null;
    const contactMemory = options.contactMemory || null;
    const mediaContext = options.mediaContext || '';
    const webSearch = options.webSearch || null;

    // Formater l'historique
    const historyText = conversationHistory
        .map(h => `${h.role === 'user' ? senderName : config.bot.name}: ${h.content}`)
        .join('\n');

    // Message d'ouverture seulement au début ou après un silence long.
    const openingMessage = shouldGreet
        ? `${getTimeBasedGreeting()} ${senderName}! 👋\n\n🤖 Je suis **${config.bot.name}**, l'assistant IA personnel de ${config.user.name}.`
        : '';

    const systemPrompt = `${openingMessage}

🌍 STATUT ACTUEL DE ${config.user.name}:
- **Localisation:** ${config.user.city}, ${config.user.country}
- **Heure:** ${localTime}
- **Actuellement:** ${status ? status.message : (isDayTime ? 'Absent ou occupé actuellement' : 'Probablement en repos/sommeil')}

👤 PROFIL DE ${config.user.name}:
${formatOwnerProfile()}

🧠 MÉMOIRE SUR ${senderName}:
${formatContactMemory(contactMemory)}

${mediaContext ? `📎 MEDIA RECU:\n${mediaContext}\n` : ''}

🌐 RECHERCHE WEB:
${formatWebSearchContext(webSearch)}

📞 EN CAS D'URGENCE:
${getEmergencyInstructions()}

${shouldGreet ? `

📋 RÈGLES DE RÉPONSE:
1. Sois professionnel mais amical
2. Dis clairement que tu es son assistant IA et que ${config.user.name} est absent actuellement
3. Explique la raison avec le statut actuel, sans inventer une autre raison
4. Propose les options d'urgence si besoin
5. Si la question est standard, réponds directement
6. Si c'est complexe, recommande d'attendre son retour
7. Utilise max 2-3 émoticônes
8. Sois concis et clair
9. Ne termine pas par "au revoir" sauf si la personne clôture explicitement la conversation
` : `

📋 CONTEXTE DE CONVERSATION:
${historyText || 'Première réponse'}

📋 RÈGLES DE SUITE:
1. Continue naturellement sans saluer
2. Ne redis pas toute ta présentation
3. Ne dis pas "au revoir" sauf si la personne clôture explicitement la conversation
`}

💬 MESSAGE DE ${senderName.toUpperCase()}: "${userMessage}"

⚠️ IMPORTANT: 
- Si shouldGreet=true → salue et explique ta nature
- Si shouldGreet=false → continue naturellement SANS resaluer
- Si la recherche web donne des resultats, cite "d'apres les resultats disponibles" et reste prudent
- Si la recherche web est desactivee ou vide pour une info recente, dis-le clairement au lieu d'inventer
- Ne partage jamais les elements listes dans "Ne jamais partager"
- Propose toujours les options d'urgence si le message semble important`;

    try {
        const response = await callGroqAPI([{ role: 'user', content: systemPrompt }]);
        return sanitizeMessage(response);
    } catch (error) {
        logger.error('Erreur generateAbsenceResponse', { error: error.message });
        // Message de fallback professionnel
        const fallback = shouldGreet
            ? `${getTimeBasedGreeting()} ${senderName}! 👋\n\n🤖 Je suis ${config.bot.name}, l'assistant IA de ${config.user.name}.\n\n${config.user.name} est actuellement absent.\n\n${getEmergencyInstructions()}`
            : `Je n'ai pas pu générer une réponse. ${config.user.name} te répondra dès son retour. 🙏`;
        return fallback;
    }
}

/**
 * Génère une réponse IA pour le propriétaire
 */
async function generateOwnerResponse(userMessage) {
    try {
        const response = await callGroqAPI([{ role: 'user', content: userMessage }]);
        return sanitizeMessage(response);
    } catch (error) {
        logger.error('Erreur generateOwnerResponse', { error: error.message });
        throw error;
    }
}

module.exports = {
    callGroqAPI,
    sanitizeMessage,
    getTimeBasedGreeting,
    getRandomEmoji,
    getLocalTime,
    getCurrentHour,
    isBotActive,
    shouldGreetConversation,
    isUrgentMessage,
    needsWebSearch,
    performWebSearch,
    analyzeMedia,
    transcribeAudioMedia,
    analyzeImageMedia,
    formatOwnerProfile,
    formatContactMemory,
    getEmergencyInstructions,
    generateAbsenceResponse,
    generateOwnerResponse,
};
