const http = require('http');
const { URL } = require('url');
const { config } = require('./config');
const db = require('./database');
const logger = require('./logger');
const services = require('./services');
const email = require('./email');

let server = null;
let clientRef = null;

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
    if (!config.dashboard.token) return false;
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8f9fc;
      --surface: #ffffff;
      --surface-alt: #f1f4f9;
      --text: #1a1d23;
      --text-secondary: #5f6368;
      --text-muted: #9aa0a6;
      --border: #e2e5ea;
      --accent: #0d9488;
      --accent-soft: #d5f5f2;
      --accent-dark: #0f766e;
      --warn: #f59e0b;
      --warn-soft: #fef3c7;
      --danger: #ef4444;
      --danger-soft: #fee2e2;
      --success: #10b981;
      --success-soft: #d1fae5;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
      --shadow-lg: 0 10px 25px -3px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.04);
      --radius: 12px;
      --radius-sm: 8px;
      --nav-w: 240px;
    }
    * { box-sizing:border-box; }
    html, body { height:100%; margin:0; }
    body {
      font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;
      background:var(--bg); color:var(--text); font-size:14px;
      display:flex;
    }
    svg.icon { width:20px; height:20px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    svg.icon-sm { width:16px; height:16px; }
    svg.icon-lg { width:24px; height:24px; }
    .icon-wrap { display:inline-flex; align-items:center; justify-content:center; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

    nav {
      width:var(--nav-w); min-width:var(--nav-w);
      background:var(--surface); border-right:1px solid var(--border);
      display:flex; flex-direction:column; height:100vh; position:sticky; top:0; z-index:50;
      padding:0;
    }
    nav .brand {
      padding:20px 20px 12px; border-bottom:1px solid var(--border);
      display:flex; align-items:center; gap:10px;
    }
    nav .brand svg { color:var(--accent); }
    nav .brand h1 { margin:0; font-size:15px; font-weight:700; letter-spacing:-0.3px; }
    nav .brand p { margin:2px 0 0; font-size:11px; color:var(--text-muted); }
    nav .nav-items { flex:1; padding:12px 10px; overflow-y:auto; }
    nav .nav-section-title { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); padding:16px 10px 6px; font-weight:700; }
    nav .nav-item {
      display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:var(--radius-sm);
      cursor:pointer; font-size:13px; font-weight:500; color:var(--text-secondary); border:none; background:none;
      width:100%; text-align:left; transition:all 0.15s; position:relative;
    }
    nav .nav-item:hover { background:var(--surface-alt); color:var(--text); }
    nav .nav-item.active { background:var(--accent-soft); color:var(--accent-dark); font-weight:600; }
    nav .nav-item .badge {
      margin-left:auto; background:var(--accent); color:#fff; padding:1px 7px; border-radius:999px;
      font-size:10px; font-weight:700; min-width:18px; text-align:center;
    }
    nav .nav-item.active .badge { background:var(--accent-dark); }
    nav .nav-footer {
      padding:12px 16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px;
    }
    nav .status-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
    nav .status-dot.online { background:var(--success); }
    nav .status-dot.offline { background:var(--danger); }
    nav .nav-footer .info { font-size:11px; color:var(--text-muted); line-height:1.3; }

    main { flex:1; min-width:0; padding:0; overflow-y:auto; height:100vh; }
    .page { display:none; padding:24px 28px; max-width:1100px; }
    .page.active { display:block; }

    .page-header { margin-bottom:24px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; letter-spacing:-0.5px; display:flex; align-items:center; gap:8px; }
    .page-header p { margin:4px 0 0; color:var(--text-secondary); font-size:13px; }

    .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:28px; }
    .stat-card {
      background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
      padding:16px 18px; box-shadow:var(--shadow-sm); transition:box-shadow 0.2s, transform 0.2s;
      display:flex; align-items:flex-start; gap:14px;
    }
    .stat-card:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
    .stat-card .stat-icon {
      width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    .stat-card .stat-content { flex:1; min-width:0; }
    .stat-card .stat-label { font-size:12px; color:var(--text-secondary); font-weight:500; }
    .stat-card .stat-value { font-size:26px; font-weight:800; line-height:1.2; letter-spacing:-1px; margin-top:2px; }
    .stat-card .stat-sub { font-size:11px; color:var(--text-muted); margin-top:2px; }
    .stat-card .stat-trend { font-size:11px; font-weight:600; margin-top:2px; }

    section { margin-bottom:28px; }
    .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px; }
    .section-header h3 { margin:0; font-size:15px; font-weight:700; display:flex; align-items:center; gap:6px; }
    .section-header .count { font-size:12px; color:var(--text-muted); font-weight:400; margin-left:4px; }
    .section-actions { display:flex; gap:6px; }

    .card {
      background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
      box-shadow:var(--shadow-sm); overflow:hidden;
    }
    .card-body { padding:16px 18px; }

    table.w-full { width:100%; border-collapse:collapse; }
    table.w-full th, table.w-full td { padding:10px 14px; text-align:left; font-size:13px; border-bottom:1px solid var(--border); vertical-align:middle; }
    table.w-full th { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; background:var(--surface); position:sticky; top:0; }
    table.w-full tr:last-child td { border-bottom:none; }
    table.w-full tr:hover td { background:var(--surface-alt); }
    table.w-full td pre { white-space:pre-wrap; margin:0; font-family:inherit; font-size:13px; max-width:320px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    table.w-full td .cell-title { font-weight:500; }
    table.w-full td .cell-sub { font-size:11px; color:var(--text-muted); margin-top:1px; }

    .tag {
      display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:999px;
      font-size:11px; font-weight:600; white-space:nowrap;
    }
    .tag.pending { background:var(--warn-soft); color:#92400e; }
    .tag.done, .tag.sent { background:var(--success-soft); color:#065f46; }
    .tag.error { background:var(--danger-soft); color:#991b1b; }
    .tag.user { background:#e0f2fe; color:#1e40af; }
    .tag.assistant { background:#ede9fe; color:#5b21b6; }
    .tag.sent-out { background:var(--accent-soft); color:var(--accent-dark); }

    .avatar {
      width:32px; height:32px; border-radius:50%; background:var(--accent-soft); color:var(--accent-dark);
      display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0;
    }
    .avatar-sm { width:24px; height:24px; font-size:10px; }

    .btn {
      display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:var(--radius-sm);
      font-size:12px; font-weight:600; font-family:inherit; cursor:pointer; border:1px solid var(--border);
      background:var(--surface); color:var(--text); transition:all 0.15s; white-space:nowrap;
    }
    .btn:hover { background:var(--surface-alt); border-color:var(--text-muted); }
    .btn-primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .btn-primary:hover { background:var(--accent-dark); border-color:var(--accent-dark); }
    .btn-sm { padding:5px 10px; font-size:11px; }
    .btn-ghost { border-color:transparent; background:transparent; }
    .btn-ghost:hover { background:var(--surface-alt); }
    .btn-danger { color:var(--danger); }
    .btn-danger:hover { background:var(--danger-soft); border-color:var(--danger); }

    .empty-state {
      padding:40px 20px; text-align:center; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:8px;
    }
    .empty-state svg { width:40px; height:40px; stroke-width:1.5; margin-bottom:4px; opacity:0.4; }
    .empty-state .title { font-weight:600; color:var(--text-secondary); }

    .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); backdrop-filter:blur(2px); align-items:center; justify-content:center; z-index:200; }
    .modal-overlay.open { display:flex; }
    .modal-box {
      background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
      padding:24px; width:90%; max-width:500px; box-shadow:var(--shadow-lg);
      animation:modalIn 0.2s ease-out;
    }
    @keyframes modalIn { from{opacity:0;transform:scale(0.95) translateY(10px);} to{opacity:1;transform:scale(1) translateY(0);} }
    .modal-box h3 { margin:0 0 4px; font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px; }
    .modal-box p.modal-desc { margin:0 0 16px; font-size:13px; color:var(--text-secondary); }
    .modal-box label { display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }
    .modal-box input, .modal-box textarea, .modal-box select {
      width:100%; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm);
      padding:9px 12px; color:var(--text); font-family:inherit; font-size:13px; transition:border-color 0.15s;
      margin-bottom:12px;
    }
    .modal-box input:focus, .modal-box textarea:focus, .modal-box select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
    .modal-box textarea { resize:vertical; min-height:80px; }
    .modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }

    .search-box {
      position:relative; display:inline-flex; align-items:center;
    }
    .search-box svg { position:absolute; left:10px; pointer-events:none; color:var(--text-muted); }
    .search-box input {
      padding:7px 10px 7px 32px; border:1px solid var(--border); border-radius:var(--radius-sm);
      background:var(--surface); font-family:inherit; font-size:12px; width:200px; color:var(--text);
      transition:all 0.15s;
    }
    .search-box input:focus { outline:none; border-color:var(--accent); width:260px; box-shadow:0 0 0 3px var(--accent-soft); }

    .activity-chart { display:flex; align-items:flex-end; gap:6px; padding:10px 0; }
    .activity-bar { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
    .activity-bar .bar {
      width:100%; border-radius:4px 4px 0 0; background:var(--accent-soft); position:relative;
      min-height:4px; transition:height 0.3s;
    }
    .activity-bar .bar .bar-fill { position:absolute; bottom:0; left:0; right:0; border-radius:4px 4px 0 0; background:var(--accent); transition:height 0.3s; }
    .activity-bar .bar-label { font-size:10px; color:var(--text-muted); white-space:nowrap; }
    .activity-bar .bar-value { font-size:10px; font-weight:600; color:var(--text-secondary); }

    .details-toggle { cursor:pointer; font-size:12px; color:var(--accent); user-select:none; display:inline-flex; align-items:center; gap:4px; }
    .details-toggle:hover { text-decoration:underline; }

    .message-bubble {
      padding:8px 12px; border-radius:var(--radius-sm); font-size:13px; line-height:1.4;
      max-width:360px; display:inline-block;
    }
    .message-bubble.in { background:var(--bg); }
    .message-bubble.out { background:var(--accent-soft); }

    @@media (max-width:768px) {
      nav { display:none; }
      .page { padding:16px; }
      .stats-grid { grid-template-columns:repeat(2,1fr); }
      .search-box input { width:140px; }
      .search-box input:focus { width:180px; }
    }
  </style>
</head>
<body>

<nav>
  <div class="brand">
    <svg class="icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <div>
      <h1>${escapeHtml(config.bot.name)}</h1>
      <p>${escapeHtml(config.user.name)}</p>
    </div>
  </div>
  <div class="nav-items">
    <div class="nav-section-title">Menu</div>
    <button class="nav-item active" data-tab="overview">
      <svg class="icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Vue d'ensemble
    </button>
    <button class="nav-item" data-tab="interventions">
      <svg class="icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Interventions
      <span class="badge" id="navInterventionBadge">0</span>
    </button>
    <button class="nav-item" data-tab="emails">
      <svg class="icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      Emails
    </button>
    <button class="nav-item" data-tab="messages">
      <svg class="icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Messages
    </button>
    <button class="nav-item" data-tab="contacts">
      <svg class="icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Contacts
    </button>
  </div>
  <div class="nav-footer">
    <span class="status-dot online" id="navStatusDot"></span>
    <div class="info" id="navStatusInfo">Connecte<br>${escapeHtml(services.getLocalTime())}</div>
  </div>
</nav>

<main>
  <div class="page active" id="page-overview">
    <div class="page-header">
      <h2>
        <svg class="icon-lg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Tableau de bord
      </h2>
      <p>Activite et statistiques du bot WhatsApp</p>
    </div>
    <div class="stats-grid" id="stats"></div>
    <section>
      <div class="section-header">
        <h3>
          <svg class="icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          En attente d'intervention
          <span class="count" id="overviewPendingCount"></span>
        </h3>
      </div>
      <div class="card"><div class="card-body" id="overviewInterventions"></div></div>
    </section>
    <section>
      <div class="section-header">
        <h3>
          <svg class="icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Activite des messages
        </h3>
      </div>
      <div class="card"><div class="card-body" id="activityChart"></div></div>
    </section>
    <section>
      <div class="section-header">
        <h3>
          <svg class="icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Derniers emails
        </h3>
      </div>
      <div class="card"><div class="card-body" id="overviewEmails"></div></div>
    </section>
  </div>

  <div class="page" id="page-interventions">
    <div class="page-header">
      <h2>
        <svg class="icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Interventions
      </h2>
      <p>Messages necessitant votre reponse personnelle</p>
    </div>
    <div class="section-header">
      <h3>
        En attente
        <span class="count" id="interventionPendingCount"></span>
      </h3>
      <div class="section-actions">
        <div class="search-box">
          <svg class="icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="interventionSearch" placeholder="Rechercher..." oninput="filterInterventions()">
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body" id="interventionList"></div></div>
  </div>

  <div class="page" id="page-emails">
    <div class="page-header">
      <h2>
        <svg class="icon-lg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Emails
      </h2>
      <p>Historique des communications email</p>
    </div>
    <div class="section-header">
      <h3>Historique <span class="count" id="emailCount"></span></h3>
      <div class="section-actions">
        <button class="btn btn-primary btn-sm" onclick="openEmailModal()">
          <svg class="icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvel email
        </button>
        <div class="search-box">
          <svg class="icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="emailSearch" placeholder="Rechercher..." oninput="filterEmails()">
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body" id="emailList"></div></div>
  </div>

  <div class="page" id="page-messages">
    <div class="page-header">
      <h2>
        <svg class="icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Messages
      </h2>
      <p>Conversations recentes triees par date</p>
    </div>
    <div class="section-header">
      <h3>Tous les messages <span class="count" id="messageCount"></span></h3>
      <div class="section-actions">
        <div class="search-box">
          <svg class="icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="messageSearch" placeholder="Rechercher..." oninput="filterMessages()">
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body" id="messageList"></div></div>
  </div>

  <div class="page" id="page-contacts">
    <div class="page-header">
      <h2>
        <svg class="icon-lg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Contacts
      </h2>
      <p>Personnes ayant echange avec le bot</p>
    </div>
    <div class="section-header">
      <h3>Tous les contacts <span class="count" id="contactCount"></span></h3>
      <div class="section-actions">
        <div class="search-box">
          <svg class="icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="contactSearch" placeholder="Rechercher..." oninput="filterContacts()">
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body" id="contactList"></div></div>
  </div>
</main>

<div class="modal-overlay" id="replyModal">
  <div class="modal-box">
    <h3>
      <svg class="icon-lg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Repondre a <span id="replyTarget"></span>
    </h3>
    <p class="modal-desc">Votre message sera envoye directement sur WhatsApp</p>
    <label>Message</label>
    <textarea id="replyText" rows="4" placeholder="Redigez votre reponse..."></textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeReplyModal()">Annuler</button>
      <button class="btn btn-primary" onclick="sendReply()">
        <svg class="icon-sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Envoyer sur WhatsApp
      </button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="emailModal">
  <div class="modal-box">
    <h3>
      <svg class="icon-lg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      Nouvel email
    </h3>
    <p class="modal-desc">Envoyez un email depuis votre compte configure</p>
    <label>Destinataire</label>
    <input id="emailTo" type="email" placeholder="adresse@email.com">
    <label>Sujet</label>
    <input id="emailSubject" type="text" placeholder="Sujet du message">
    <label>Corps du message</label>
    <textarea id="emailBody" rows="5" placeholder="Redigez votre message..."></textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeEmailModal()">Annuler</button>
      <button class="btn btn-primary" onclick="sendEmailFromDashboard()">
        <svg class="icon-sm" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Envoyer
      </button>
    </div>
  </div>
</div>

<script>
const token = new URLSearchParams(location.search).get('token') || '';
const authHeaders = token ? { 'Authorization': 'Bearer ' + encodeURIComponent(token) } : {};
const fetchJson = (path, opts) => fetch(path, { headers: authHeaders, ...opts }).then(r => r.json());
const esc = v => String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

let allInterventions = [], allEmails = [], allMessages = [], allContacts = [];

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + item.dataset.tab).classList.add('active');
    if (item.dataset.tab === 'overview') loadOverview();
    if (item.dataset.tab === 'interventions') loadInterventions();
    if (item.dataset.tab === 'emails') loadEmails();
    if (item.dataset.tab === 'messages') loadMessages();
    if (item.dataset.tab === 'contacts') loadContacts();
  });
});

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d+'Z');
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '<1 min';
  if (diff < 3600000) return Math.floor(diff/60000)+' min';
  if (diff < 86400000) return Math.floor(diff/3600000)+'h';
  return date.toLocaleDateString('fr-FR', {day:'numeric',month:'short'});
}

function phoneAvatar(name, phone) {
  const initial = (name||phone||'?').charAt(0).toUpperCase();
  return '<span class="avatar avatar-sm">'+esc(initial)+'</span>';
}

function openReplyModal(phone, name, message) {
  document.getElementById('replyTarget').textContent = esc(name || phone);
  document.getElementById('replyText').value = message ? 'Re: '+message.substring(0,60)+'...\\n\\n' : '';
  document.getElementById('replyModal').classList.add('open');
}
function closeReplyModal() { document.getElementById('replyModal').classList.remove('open'); }
async function sendReply() {
  const text = document.getElementById('replyText').value.trim();
  if (!text) return;
  const btn = document.querySelector('#replyModal .btn-primary');
  btn.disabled = true; btn.innerHTML = '<span class="icon-wrap"><svg class="icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Envoi...';
  try {
    const result = await fetchJson('/api/reply', { method:'POST', body:JSON.stringify({text}), headers:{...authHeaders,'Content-Type':'application/json'} });
    if (result.success) { closeReplyModal(); loadInterventions(); loadOverview(); }
    else alert('Erreur: '+result.error);
  } catch(e) { alert('Erreur réseau'); }
  btn.disabled = false; btn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer sur WhatsApp';
}

function openEmailModal(to, subject) {
  if (to) document.getElementById('emailTo').value = to;
  if (subject) document.getElementById('emailSubject').value = subject;
  document.getElementById('emailModal').classList.add('open');
}
function closeEmailModal() { document.getElementById('emailModal').classList.remove('open'); }
async function sendEmailFromDashboard() {
  const to = document.getElementById('emailTo').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();
  if (!to || !subject || !body) return alert('Tous les champs sont requis');
  const btn = document.querySelector('#emailModal .btn-primary');
  btn.disabled = true; btn.innerHTML = '<span class="icon-wrap"><svg class="icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Envoi...';
  try {
    const result = await fetchJson('/api/send-email', { method:'POST', body:JSON.stringify({to,subject,body}), headers:{...authHeaders,'Content-Type':'application/json'} });
    if (result.success) { closeEmailModal(); loadEmails(); }
    else alert('Erreur: '+result.error);
  } catch(e) { alert('Erreur réseau'); }
  btn.disabled = false; btn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Envoyer';
}

async function loadOverview() {
  const data = await fetchJson('/api/full-stats');
  const colors = [
    { bg:'#d5f5f2', c:'#0f766e' },
    { bg:'#dbeafe', c:'#1d4ed8' },
    { bg:'#fef3c7', c:'#92400e' },
    { bg:'#ede9fe', c:'#5b21b6' },
    { bg:'#fce7f3', c:'#9d174d' },
    { bg:'#d1fae5', c:'#065f46' },
  ];
  const statDefs = [
    { label:'Messages', value:data.totalMessages, sub:data.userMessages+' utilisateur / '+data.botMessages+' bot', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    { label:'Contacts', value:data.totalContacts, sub:'personnes differentes', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
    { label:'En attente', value:data.pendingInterventions, sub:'interventions requises', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', warn:true },
    { label:'Emails', value:data.totalEmails||0, sub:'echanges par email', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' },
    { label:'Fichiers media', value:data.totalMedia||0, sub:'images, audios, videos', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
    { label:'Appels API', value:data.totalApiCalls||0, sub:data.avgApiDuration+'ms en moyenne', icon:'<svg class="icon-lg" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  ];
  document.getElementById('stats').innerHTML = statDefs.map((s,i) =>
    '<div class="stat-card"><div class="stat-icon" style="background:'+colors[i%6].bg+';color:'+colors[i%6].c+'">'+s.icon+'</div><div class="stat-content"><div class="stat-label">'+esc(s.label)+'</div><div class="stat-value" style="color:'+(s.warn&&data.pendingInterventions>0?colors[2].c:'')+'">'+(s.warn?data.pendingInterventions:s.value)+'</div><div class="stat-sub">'+esc(s.sub)+'</div></div></div>'
  ).join('');

  const pending = await fetchJson('/api/interventions?limit=5');
  document.getElementById('overviewPendingCount').textContent = '('+pending.filter(i=>i.status==='pending').length+')';
  renderInterventionTable(document.getElementById('overviewInterventions'), pending.filter(i=>i.status==='pending'), true);

  // Activity chart (7 days)
  try {
    const activity = await fetchJson('/api/message-activity');
    if (activity.length) {
      const maxVal = Math.max(...activity.map(d=>d.count), 1);
      document.getElementById('activityChart').innerHTML =
        '<div class="activity-chart">' +
        activity.map(d => {
          const pct = (d.count/maxVal*60);
          return '<div class="activity-bar"><div class="bar" style="height:'+Math.max(4,pct)+'px"><div class="bar-fill" style="height:'+pct+'px"></div></div><div class="bar-value">'+d.count+'</div><div class="bar-label">'+d.day+'</div></div>';
        }).join('') +
        '</div>';
    } else {
      document.getElementById('activityChart').innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><div class="title">Aucune donnee</div><span>Les statistiques apparaissent avec les messages</span></div>';
    }
  } catch(e) {
    document.getElementById('activityChart').innerHTML = '<div class="empty-state">Chart indisponible</div>';
  }

  const emails = await fetchJson('/api/emails?limit=5');
  renderEmailTable(document.getElementById('overviewEmails'), emails, true);
}

function renderInterventionTable(container, items, simple) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div class="title">Aucune intervention</div><span>Tout est sous controle</span></div>';
    return;
  }
  container.innerHTML =
    '<table class="w-full"><thead><tr>' +
    (simple ? '<th>Contact</th><th>Message</th><th>Date</th><th></th>' : '<th>Contact</th><th>Raison</th><th>Message</th><th>Date</th><th></th>') +
    '</tr></thead><tbody>' +
    items.map(i => {
      const name = i.sender_name || i.phone;
      const phone = i.phone;
      return '<tr>' +
        (simple ? '<td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(name, phone)+'<div><div class="cell-title">'+esc(name)+'</div><div class="cell-sub">'+esc(phone)+'</div></div></div></td>' : '<td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(name, phone)+'<div><div class="cell-title">'+esc(name)+'</div><div class="cell-sub">'+esc(phone)+'</div></div></div></td>') +
        (!simple ? '<td><span class="tag pending">'+esc(i.reason||'urgent')+'</span></td>' : '') +
        '<td><pre>'+esc(i.message)+'</pre></td>' +
        '<td><span class="cell-sub">'+formatDate(i.created_at)+'</span></td>' +
        '<td><button class="btn btn-primary btn-sm" onclick="openReplyModal(\\''+esc(i.phone)+'\\',\\''+esc(name)+'\\',\\''+esc(i.message).replace(/'/g,"\\\\'")+'\\')"><svg class="icon-sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Repondre</button></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function renderEmailTable(container, items, simple) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><div class="title">Aucun email</div><span>Les emails envoyes/recus apparaitront ici</span></div>';
    return;
  }
  container.innerHTML =
    '<table class="w-full"><thead><tr>' +
    (simple ? '<th>Sujet</th><th>Contact</th><th>Statut</th><th>Date</th>' : '<th>Sujet</th><th>Contact</th><th>Direction</th><th>Statut</th><th>Date</th>') +
    '</tr></thead><tbody>' +
    items.map(e => {
      const dir = e.direction === 'sent' ? 'Envoye' : (e.direction === 'received' ? 'Recu' : '');
      return '<tr>' +
        '<td><div class="cell-title">'+esc(e.subject||'(sans sujet)')+'</div></td>' +
        '<td>'+esc(e.recipient||e.sender||'')+'</td>' +
        (!simple ? '<td><span class="tag '+(e.direction==='sent'?'sent-out':'user')+'">'+(e.direction==='sent'?'Sortant':'Entrant')+'</span></td>' : '') +
        '<td><span class="tag '+esc(e.status)+'">'+esc(e.status)+'</span></td>' +
        '<td><span class="cell-sub">'+formatDate(e.created_at)+'</span></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function loadInterventions() {
  fetchJson('/api/interventions').then(list => {
    allInterventions = list;
    document.getElementById('navInterventionBadge').textContent = list.filter(i=>i.status==='pending').length;
    document.getElementById('interventionPendingCount').textContent = '('+list.filter(i=>i.status==='pending').length+')';
    filterInterventions();
  });
}

function filterInterventions() {
  const q = (document.getElementById('interventionSearch').value||'').toLowerCase();
  const list = allInterventions.filter(i => i.status === 'pending' && (!q || (i.sender_name||'').toLowerCase().includes(q) || (i.phone||'').includes(q) || (i.message||'').toLowerCase().includes(q)));
  const done = allInterventions.filter(i => i.status === 'done' && (!q || (i.sender_name||'').toLowerCase().includes(q) || (i.phone||'').includes(q) || (i.message||'').toLowerCase().includes(q)));
  const el = document.getElementById('interventionList');
  if (!list.length && !done.length) {
    el.innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div class="title">Aucune intervention</div><span>Tout est sous controle</span></div>';
    return;
  }
  let html = '';
  if (list.length) {
    html += '<table class="w-full"><thead><tr><th>Contact</th><th>Raison</th><th>Message</th><th>Date</th><th></th></tr></thead><tbody>' +
      list.map(i => {
        const name = i.sender_name || i.phone;
        return '<tr><td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(name, i.phone)+'<div><div class="cell-title">'+esc(name)+'</div><div class="cell-sub">'+esc(i.phone)+'</div></div></div></td>' +
          '<td><span class="tag pending">'+esc(i.reason||'urgent')+'</span></td>' +
          '<td><pre>'+esc(i.message)+'</pre></td>' +
          '<td><span class="cell-sub">'+formatDate(i.created_at)+'</span></td>' +
          '<td><button class="btn btn-primary btn-sm" onclick="openReplyModal(\\''+esc(i.phone)+'\\',\\''+esc(name)+'\\',\\''+esc(i.message).replace(/'/g,"\\\\'")+'\\')"><svg class="icon-sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Repondre</button></td></tr>';
      }).join('') + '</tbody></table>';
  }
  if (done.length) {
    html += '<br><details><summary class="details-toggle">Afficher les traites ('+done.length+')</summary><table class="w-full" style="margin-top:8px"><thead><tr><th>Contact</th><th>Message</th><th>Traite le</th></tr></thead><tbody>' +
      done.map(i => '<tr><td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(i.sender_name||i.phone, i.phone)+'<div class="cell-title">'+esc(i.sender_name||i.phone)+'</div></div></td><td><pre>'+esc(i.message)+'</pre></td><td><span class="cell-sub">'+formatDate(i.created_at)+'</span></td></tr>').join('') +
      '</tbody></table></details>';
  }
  el.innerHTML = html;
}

function loadEmails() {
  fetchJson('/api/emails').then(list => {
    allEmails = list;
    document.getElementById('emailCount').textContent = '('+list.length+')';
    filterEmails();
  });
}
function filterEmails() {
  const q = (document.getElementById('emailSearch').value||'').toLowerCase();
  const filtered = allEmails.filter(e => !q || (e.subject||'').toLowerCase().includes(q) || (e.recipient||'').toLowerCase().includes(q) || (e.sender||'').toLowerCase().includes(q));
  renderEmailTable(document.getElementById('emailList'), filtered, false);
}

function loadMessages() {
  fetchJson('/api/messages').then(list => {
    allMessages = list;
    document.getElementById('messageCount').textContent = '('+list.length+')';
    filterMessages();
  });
}
function filterMessages() {
  const q = (document.getElementById('messageSearch').value||'').toLowerCase();
  const filtered = allMessages.filter(m => !q || (m.phone||'').includes(q) || (m.content||'').toLowerCase().includes(q));
  const el = document.getElementById('messageList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div class="title">Aucun message</div><span>Les messages apparaitront apres les conversations</span></div>';
    return;
  }
  el.innerHTML =
    '<table class="w-full"><thead><tr><th>Contact</th><th>Role</th><th>Message</th><th>Date</th></tr></thead><tbody>' +
    filtered.map(m => {
      const isUser = m.role === 'user';
      return '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(m.phone, m.phone)+'<div class="cell-title">'+esc(m.phone)+'</div></div></td>' +
        '<td><span class="tag '+m.role+'">'+esc(m.role)+'</span></td>' +
        '<td><div class="message-bubble '+(isUser?'in':'out')+'">'+esc(m.content)+'</div></td>' +
        '<td><span class="cell-sub">'+formatDate(m.timestamp)+'</span></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function loadContacts() {
  fetchJson('/api/contacts').then(list => {
    allContacts = list;
    document.getElementById('contactCount').textContent = '('+list.length+')';
    filterContacts();
  });
}
function filterContacts() {
  const q = (document.getElementById('contactSearch').value||'').toLowerCase();
  const filtered = allContacts.filter(c => !q || (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q));
  const el = document.getElementById('contactList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><svg class="icon-lg" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div class="title">Aucun contact</div><span>Les contacts apparaissent apres les echanges</span></div>';
    return;
  }
  el.innerHTML =
    '<table class="w-full"><thead><tr><th>Contact</th><th>Telephone</th><th>Messages</th><th>Dernier message</th><th>Notes</th></tr></thead><tbody>' +
    filtered.map(c =>
      '<tr><td><div style="display:flex;align-items:center;gap:8px">'+phoneAvatar(c.name||c.phone, c.phone)+'<div class="cell-title">'+esc(c.name||c.phone)+'</div></div></td>' +
      '<td>'+esc(c.phone)+'</td>' +
      '<td><span class="tag user">'+esc(c.message_count||0)+'</span></td>' +
      '<td><span class="cell-sub">'+formatDate(c.last_message_at||c.last_seen||'')+'</span></td>' +
      '<td><pre>'+esc(c.notes||'')+'</pre></td></tr>'
    ).join('') +
    '</tbody></table>';
}

// Init
loadOverview();

// Auto refresh every 15s for overview
setInterval(() => {
  const active = document.querySelector('.nav-item.active');
  if (active && active.dataset.tab === 'overview') loadOverview();
}, 15000);
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

    if (url.pathname === '/api/full-stats') {
        return sendJson(res, await db.getDashboardFullStats());
    }

    if (url.pathname === '/api/message-activity') {
        return sendJson(res, await db.getMessageActivity(7));
    }

    if (url.pathname === '/api/interventions') {
        const limit = parseInt(url.searchParams.get('limit'), 10) || 30;
        return sendJson(res, await db.getInterventionQueue(limit));
    }

    if (url.pathname === '/api/emails') {
        const limit = parseInt(url.searchParams.get('limit'), 10) || 30;
        return sendJson(res, await db.getEmailLogs(limit));
    }

    if (url.pathname === '/api/messages') {
        return sendJson(res, await db.getRecentMessages(80));
    }

    if (url.pathname === '/api/contacts') {
        return sendJson(res, await db.getContactsOverview(100));
    }

    if (url.pathname === '/api/send-email' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { to, subject, body: emailBody } = JSON.parse(body);
            const info = await email.sendEmail(to, subject, emailBody);
            await db.logEmail('sent', to, null, subject, 'sent', info.messageId, null);
            return sendJson(res, { success: true, messageId: info.messageId });
        } catch (error) {
            return sendJson(res, { success: false, error: error.message }, 500);
        }
    }

    if (url.pathname === '/api/reply' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { phone, text } = JSON.parse(body);
            if (!clientRef || !text) {
                return sendJson(res, { success: false, error: 'Client WhatsApp non connecte ou texte vide' }, 400);
            }
            await clientRef.sendMessage(`${phone}@c.us`, text);
            await db.saveMessage(phone, 'assistant', text);
            await db.markInterventionDone(parseInt(url.searchParams.get('id'), 10) || 0);
            return sendJson(res, { success: true });
        } catch (error) {
            return sendJson(res, { success: false, error: error.message }, 500);
        }
    }

    return sendJson(res, { error: 'Not found' }, 404);
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
    });
}

function startDashboard(client) {
    if (!config.dashboard.enabled || server) return null;
    if (client) clientRef = client;

    server = http.createServer((req, res) => {
        routeRequest(req, res).catch(error => {
            logger.exception(error, 'Erreur dashboard');
            sendJson(res, { error: error.message }, 500);
        });
    });

    server.listen(config.dashboard.port, config.dashboard.host, () => {
        const tokenPart = config.dashboard.token ? `?token=${config.dashboard.token}` : '';
        logger.info(`📊 Dashboard: http://${config.dashboard.host}:${config.dashboard.port}${tokenPart}`);
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
    setClient: (c) => { clientRef = c; },
};
