/**
 * Dashboard local minimal sans dependance externe.
 */

const http = require('http');
const { URL } = require('url');
const { config } = require('./config');
const db = require('./database');
const logger = require('./logger');
const services = require('./services');

let server = null;

function sendJson(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data, null, 2));
}

function sendHtml(res, html, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(html);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isAuthorized(req, url) {
    if (!config.dashboard.token) return true;
    const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const queryToken = url.searchParams.get('token');
    return headerToken === config.dashboard.token || queryToken === config.dashboard.token;
}

function renderDashboardShell() {
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(config.bot.name)} Dashboard</title>
  <style>
    :root { color-scheme: light; --bg:#f7f8fb; --panel:#fff; --text:#1e2430; --muted:#667085; --line:#dde3ed; --accent:#0f766e; --warn:#b45309; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
    header { padding:20px 24px; background:#101828; color:white; }
    header h1 { margin:0; font-size:22px; letter-spacing:0; }
    header p { margin:6px 0 0; color:#cbd5e1; }
    main { max-width:1180px; margin:0 auto; padding:22px; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; }
    .card, table { background:var(--panel); border:1px solid var(--line); border-radius:8px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
    .card { padding:16px; }
    .label { color:var(--muted); font-size:13px; }
    .value { margin-top:8px; font-size:28px; font-weight:750; }
    section { margin-top:20px; }
    section h2 { font-size:18px; margin:0 0 10px; }
    table { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; }
    th, td { text-align:left; padding:11px 12px; border-bottom:1px solid var(--line); vertical-align:top; font-size:14px; }
    th { color:var(--muted); font-weight:650; background:#f9fafb; }
    tr:last-child td { border-bottom:0; }
    .pill { display:inline-block; padding:3px 8px; border-radius:999px; background:#ecfdf3; color:var(--accent); font-size:12px; font-weight:650; }
    .muted { color:var(--muted); }
    pre { white-space:pre-wrap; margin:0; font-family:inherit; color:#344054; }
    @media (max-width: 860px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } main { padding:14px; } }
    @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } th:nth-child(3), td:nth-child(3) { display:none; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(config.bot.name)} Dashboard</h1>
    <p>Assistant IA WhatsApp de ${escapeHtml(config.user.name)} · ${escapeHtml(services.getLocalTime())}</p>
  </header>
  <main>
    <div id="stats" class="grid"></div>
    <section>
      <h2>Contacts</h2>
      <div id="contacts"></div>
    </section>
    <section>
      <h2>Messages recents</h2>
      <div id="messages"></div>
    </section>
  </main>
  <script>
    const token = new URLSearchParams(location.search).get('token') || '';
    const withToken = path => token ? path + '?token=' + encodeURIComponent(token) : path;
    const esc = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
    async function load() {
      const [stats, contacts, messages] = await Promise.all([
        fetch(withToken('/api/stats')).then(r => r.json()),
        fetch(withToken('/api/contacts')).then(r => r.json()),
        fetch(withToken('/api/messages')).then(r => r.json())
      ]);
      document.querySelector('#stats').innerHTML = [
        ['Messages', stats.totalMessages],
        ['Contacts', stats.totalContacts],
        ['Medias', stats.totalMedia],
        ['Appels IA', stats.totalApiCalls]
      ].map(([label, value]) => '<div class="card"><div class="label">'+esc(label)+'</div><div class="value">'+esc(value)+'</div></div>').join('');
      document.querySelector('#contacts').innerHTML = '<table><thead><tr><th>Nom</th><th>Telephone</th><th>Dernier message</th><th>Memoire</th></tr></thead><tbody>' +
        contacts.map(c => '<tr><td><span class="pill">'+esc(c.name || 'ami')+'</span></td><td>'+esc(c.phone)+'</td><td class="muted">'+esc(c.last_message_at || c.last_seen || '')+'</td><td><pre>'+esc(c.notes || '')+'</pre></td></tr>').join('') +
        '</tbody></table>';
      document.querySelector('#messages').innerHTML = '<table><thead><tr><th>Contact</th><th>Role</th><th>Date</th><th>Message</th></tr></thead><tbody>' +
        messages.map(m => '<tr><td>'+esc(m.phone)+'</td><td>'+esc(m.role)+'</td><td class="muted">'+esc(m.timestamp)+'</td><td>'+esc(m.content)+'</td></tr>').join('') +
        '</tbody></table>';
    }
    load().catch(error => { document.querySelector('main').innerHTML = '<p>Erreur dashboard: '+esc(error.message)+'</p>'; });
  </script>
</body>
</html>`;
}

async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (!isAuthorized(req, url)) {
        return sendJson(res, { error: 'Unauthorized' }, 401);
    }

    if (url.pathname === '/') {
        return sendHtml(res, renderDashboardShell());
    }

    if (url.pathname === '/api/stats') {
        return sendJson(res, await db.getDashboardStats());
    }

    if (url.pathname === '/api/contacts') {
        return sendJson(res, await db.getContactsOverview(100));
    }

    if (url.pathname === '/api/messages') {
        return sendJson(res, await db.getRecentMessages(80));
    }

    return sendJson(res, { error: 'Not found' }, 404);
}

function startDashboard() {
    if (!config.dashboard.enabled || server) return null;

    server = http.createServer((req, res) => {
        routeRequest(req, res).catch(error => {
            logger.error('Erreur dashboard', { error: error.message });
            sendJson(res, { error: 'Dashboard error' }, 500);
        });
    });

    server.listen(config.dashboard.port, config.dashboard.host, () => {
        logger.info(`📊 Dashboard: http://${config.dashboard.host}:${config.dashboard.port}`);
    });

    server.on('error', (error) => {
        logger.error('Erreur serveur dashboard', { error: error.message });
    });

    return server;
}

function stopDashboard() {
    return new Promise((resolve) => {
        if (!server) return resolve();
        server.close(() => {
            server = null;
            resolve();
        });
    });
}

module.exports = {
    startDashboard,
    stopDashboard,
};
