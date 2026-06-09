/**
 * Tests unitaires basiques pour le WhatsApp Groq Bot
 * À exécuter avec: npm test
 */

const assert = require('assert');
const { config } = require('./src/config');
const services = require('./src/services');
const rateLimiter = require('./src/rateLimiter');

console.log('\n📋 Exécution des tests...\n');

// Test 1: Configuration
console.log('✓ Test 1: Configuration chargée');
assert(config.groq.apiKey, 'GROQ_API_KEY manquante');
assert(config.user.phone, 'MY_PHONE manquée');
assert(config.bot.absenceStart, 'ABSENCE_START manquée');
assert(config.bot.absenceEnd, 'ABSENCE_END manquée');
console.log('  ✅ Configuration valide\n');

// Test 2: Sanitization
console.log('✓ Test 2: Sanitization des messages');
const testMessage = 'Bonjour\n\n\n\ntest<script>alert("xss")</script>';
const sanitized = services.sanitizeMessage(testMessage);
assert(sanitized.includes('script') === false, 'Sanitization échouée');
assert(sanitized.length <= 4096, 'Limitation taille échouée');
console.log('  ✅ Sanitization OK\n');

// Test 3: Rate Limiter
console.log('✓ Test 3: Rate Limiting');
rateLimiter.reset('test_user');
const check1 = rateLimiter.checkLimit('test_user');
assert(check1.allowed === true, 'Première requête devrait être acceptée');

// Simuler 11 requêtes
for (let i = 0; i < config.rateLimit.perUser; i++) {
    rateLimiter.checkLimit('test_user');
}
const checkFinal = rateLimiter.checkLimit('test_user');
assert(checkFinal.allowed === false, 'Rate limit devrait être déclenché');
console.log('  ✅ Rate Limiter OK\n');

// Test 4: Services
console.log('✓ Test 4: Services');
const greeting = services.getTimeBasedGreeting();
assert(greeting, 'Greeting non généré');
assert(['🌅 Bonjour', '☀️ Bon après-midi', '🌙 Bonsoir'].includes(greeting), 'Greeting invalide');

const emoji = services.getRandomEmoji();
assert(emoji, 'Emoji non généré');
assert(emoji.length > 0, 'Emoji vide');

const hour = services.getCurrentHour();
assert(typeof hour === 'number', 'Heure invalide');
assert(hour >= 0 && hour < 24, 'Heure hors limites');

const active = services.isBotActive();
assert(typeof active === 'boolean', 'Statut bot invalide');

assert(services.shouldGreetConversation([]) === true, 'Devrait saluer au premier message');

const recentHistory = [{ role: 'user', content: 'Salut', timestamp: new Date().toISOString() }];
assert(services.shouldGreetConversation(recentHistory) === false, 'Ne devrait pas resaluer avant 10 minutes');

const oldTimestamp = new Date(Date.now() - 11 * 60 * 1000).toISOString();
const oldHistory = [{ role: 'user', content: 'Salut', timestamp: oldTimestamp }];
assert(services.shouldGreetConversation(oldHistory) === true, 'Devrait resaluer après 10 minutes de silence');

assert(services.isUrgentMessage('C’est urgent, appelle-moi') === true, 'Urgence non détectée');
assert(services.needsWebSearch('Tu peux chercher les actualités aujourd’hui ?') === true, 'Recherche web non détectée');
assert(services.formatOwnerProfile().includes(config.user.name), 'Profil propriétaire non intégré');
console.log('  ✅ Services OK\n');

// Test 5: Tests de configuration spécifiques
console.log('✓ Test 5: Configuration spécifique');
assert(config.user.country === 'Centrafrique', 'Pays incorrect');
assert(config.user.city === 'Bangui', 'Ville incorrecte');
assert(config.user.timezone === 'Africa/Bangui', 'Fuseau horaire incorrect');
console.log('  ✅ Configuration spécifique OK\n');

console.log('═══════════════════════════════════════');
console.log('✅ TOUS LES TESTS RÉUSSIS!');
console.log('═══════════════════════════════════════\n');
