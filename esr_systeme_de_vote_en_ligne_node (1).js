/**
 * ESR — Système de Vote en Ligne (unique fichier)
 * Auteur: 
 *
 * ▶ Fonctionnalités
 * - Page de vote responsive servie par le serveur.
 * - Authentification par CODE ÉLECTEUR (liste blanche).
 * - Un seul vote par électeur (verrouillage automatique).
 * - Candidats et postes chargés depuis un fichier JSON.
 * - Tableau de résultats en temps réel (vue admin protégée par clé).
 * - Export CSV.
 * - Persistance locale des votes sur disque (JSON) pour redémarrage fiable.
 *
 * ▶ Prérequis
 * - Node.js 18+
 * - npm i express body-parser cors jsonwebtoken bcryptjs nanoid
 *
 * ▶ Démarrer
 * 1) Placez ce fichier sous le nom: server.js
 * 2) Créez les fichiers data/candidates.json et data/voters.json (exemples ci-dessous).
 * 3) Lancez:
 *    ADMIN_KEY=changez-moi PORT=3000 node server.js
 * 4) Ouvrez http://localhost:3000 pour voter.
 *    Vue admin: http://localhost:3000/admin  (clé requise)
 *
 * ▶ Schéma des fichiers
 * data/candidates.json
 * {
 *   "positions": [
 *     {"id":"dir-construction","label":"Directeur du Département Construction"},
 *     {"id":"chef-etudes","label":"Chef du Service Études & Plans"},
 *     {"id":"chef-travaux","label":"Chef du Service Travaux & Exécution"},
 *     {"id":"chef-log","label":"Chef du Service Logistique & Matériaux"},
 *     {"id":"chef-admin","label":"Chef du Service Administratif & Financier"},
 *     {"id":"chef-qualite","label":"Chef du Service Contrôle Qualité"},
 *     {"id":"chef-com","label":"Chef du Service Relations & Communication"}
 *   ],
 *   "candidates": [
 *     {"id":"c1","name":"Alice K.","positionId":"dir-construction","bio":"Ingénieure civile 10 ans"},
 *     {"id":"c2","name":"Benoit M.","positionId":"dir-construction","bio":"Architecte, chef de projets"},
 *     {"id":"c3","name":"Chantal N.","positionId":"chef-etudes","bio":"MSc Architecture"},
 *     {"id":"c4","name":"David T.","positionId":"chef-travaux","bio":"Conducteur de travaux sénior"}
 *   ]
 * }
 *
 * data/voters.json
 * {
 *   "voters": [
 *     {"id":"VOTER-001","name":"Esron Tshibamba","used":false},
 *     {"id":"VOTER-002","name":"John Doe","used":false}
 *   ]
 * }
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');

// ────────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changez-moi';

const DATA_DIR = path.join(__dirname, 'data');
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.json');
const VOTERS_FILE = path.join(DATA_DIR, 'voters.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(VOTES_FILE)) fs.writeFileSync(VOTES_FILE, JSON.stringify({ votes: [] }, null, 2));

app.use(cors());
app.use(bodyParser.json());

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}
function writeJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2)); }

function loadData() {
  const candidates = readJSON(CANDIDATES_FILE) || { positions: [], candidates: [] };
  const voters = readJSON(VOTERS_FILE) || { voters: [] };
  const votes = readJSON(VOTES_FILE) || { votes: [] };
  return { candidates, voters, votes };
}

function saveVotes(votes) { writeJSON(VOTES_FILE, votes); }
function saveVoters(voters) { writeJSON(VOTERS_FILE, voters); }

function tally(candidates, votes) {
  const map = {}; // { positionId: { candidateId: count } }
  for (const pos of candidates.positions) {
    map[pos.id] = {};
    for (const cand of candidates.candidates.filter(c=>c.positionId===pos.id)) {
      map[pos.id][cand.id] = 0;
    }
  }
  for (const v of votes.votes) {
    for (const [positionId, candidateId] of Object.entries(v.selections || {})) {
      if (map[positionId] && map[positionId][candidateId] !== undefined) {
        map[positionId][candidateId]++;
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────────────────
// Routes — Frontend
// ────────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ESR — Élection Département Construction</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
      :root { --bg:#0f172a; --card:#111827; --muted:#9ca3af; --accent:#22c55e; --text:#f8fafc; }
      *{box-sizing:border-box;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Arial}
      body{margin:0;background:linear-gradient(120deg,#0b1220,#0f172a);color:var(--text)}
      .container{max-width:980px;margin:0 auto;padding:24px}
      .card{background:rgba(17,24,39,.75);backdrop-filter: blur(8px);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
      h1{font-weight:800;letter-spacing:-0.02em;margin:0 0 8px}
      .muted{color:var(--muted)}
      .row{display:grid;gap:16px}
      @media(min-width:800px){.row{grid-template-columns:1.2fr .8fr}}
      input,select,button,textarea{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#0b1220;color:var(--text)}
      button{cursor:pointer;font-weight:700;background:linear-gradient(135deg,#22c55e,#16a34a);border:none}
      button:disabled{opacity:.6;cursor:not-allowed}
      .pill{font-size:12px;padding:4px 10px;border-radius:999px;background:rgba(34,197,94,.15);color:#86efac;display:inline-block}
      .candidate{display:flex;gap:12px;align-items:flex-start;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:12px}
      .candidate input{width:auto}
      .footer{font-size:12px;color:var(--muted);text-align:center;margin-top:18px}
      .success{border-left:4px solid #22c55e;padding:10px;border-radius:8px;background:rgba(34,197,94,.1)}
      .error{border-left:4px solid #ef4444;padding:10px;border-radius:8px;background:rgba(239,68,68,.1)}
      .tag{font-size:11px;color:#cbd5e1}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>Élection — Département Construction (ESR)</h1>
        <p class="muted">Vote en ligne sécurisé. Entrez votre <strong>code électeur</strong>, choisissez un candidat par poste, puis validez.</p>
        <div id="alerts"></div>
        <div class="row">
          <div>
            <div style="display:grid;gap:12px" id="step-auth">
              <label>Code électeur</label>
              <input id="voterId" placeholder="Ex: VOTER-001" />
              <button id="btnAuth">Vérifier & Continuer</button>
              <div class="tag">Besoin d'aide ? Contactez l'administration ESR.</div>
            </div>

            <div id="step-vote" style="display:none;">
              <div id="forms"></div>
              <button id="btnSubmit" style="margin-top:14px">Soumettre mon vote</button>
              <div class="footer">Une fois soumis, votre vote est définitif.</div>
            </div>

            <div id="done" style="display:none" class="success">Merci ! Votre vote a été enregistré. Vous pouvez fermer la page.</div>
          </div>

          <div>
            <div class="pill">Transparence</div>
            <p class="muted">Un seul vote par code électeur. Les résultats ne sont visibles publiquement qu'après la clôture par l'administration.</p>
            <div class="pill">Calendrier</div>
            <ul class="muted">
              <li>Clôture automatique à l'heure définie par ESR (si activée côté serveur).</li>
              <li>Réclamations: 24h après la proclamation.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer">© ESR — Ensemble Sur la Réussite</div>
    </div>

    <script>
      const $ = (q)=>document.querySelector(q);
      const alerts = (msg, type='error')=>{ $('#alerts').innerHTML = `<div class="${type}">${msg}</div>` };

      let voterId = null;
      let schema = null; // positions + candidates

      async function fetchSchema(){
        const r = await fetch('/api/candidates');
        if(!r.ok){ alerts("Impossible de charger les candidats."); return; }
        schema = await r.json();
      }

      function renderForms(){
        const wrap = document.getElementById('forms');
        wrap.innerHTML = '';
        for(const pos of schema.positions){
          const cands = schema.candidates.filter(c=>c.positionId===pos.id);
          const block = document.createElement('div');
          block.style.marginBottom = '16px';
          block.innerHTML = `<h3 style="margin:6px 0 8px">${pos.label}</h3>` +
            cands.map(c=>`
              <label class="candidate">
                <input type="radio" name="${pos.id}" value="${c.id}" required />
                <div>
                  <div><strong>${c.name}</strong></div>
                  <div class="muted" style="font-size:13px">${c.bio||''}</div>
                </div>
              </label>
            `).join('');
          wrap.appendChild(block);
        }
      }

      $('#btnAuth').addEventListener('click', async ()=>{
        const id = $('#voterId').value.trim();
        if(!id){ alerts('Entrez votre code électeur.'); return; }
        const r = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ voterId: id }) });
        const data = await r.json();
        if(!r.ok){ alerts(data.message||'Code invalide.'); return; }
        voterId = id;
        await fetchSchema();
        renderForms();
        $('#step-auth').style.display='none';
        $('#step-vote').style.display='block';
        alerts('Code vérifié. Vous pouvez voter.', 'success');
      });

      $('#btnSubmit').addEventListener('click', async ()=>{
        if(!schema){ alerts('Schéma non chargé.'); return; }
        const selections = {};
        for(const pos of schema.positions){
          const chosen = document.querySelector(`input[name="${pos.id}"]:checked`);
          if(!chosen){ alerts(`Veuillez choisir un candidat pour: ${pos.label}`); return; }
          selections[pos.id] = chosen.value;
        }
        const r = await fetch('/api/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ voterId, selections }) });
        const data = await r.json();
        if(!r.ok){ alerts(data.message||'Erreur de soumission.'); return; }
        $('#step-vote').style.display='none';
        $('#done').style.display='block';
        alerts('Vote soumis avec succès.', 'success');
      });
    </script>
  </body>
  </html>`);
});

// ────────────────────────────────────────────────────────────────────────────────
// API — Données
// ────────────────────────────────────────────────────────────────────────────────
app.get('/api/candidates', (req, res) => {
  const { candidates } = loadData();
  res.json(candidates);
});

// Vérifier code électeur
app.post('/api/auth', (req, res) => {
  const { voterId } = req.body || {};
  const { voters } = loadData();
  const exists = voters.voters.find(v => v.id === voterId);
  if (!exists) return res.status(400).json({ message: 'Code électeur introuvable.' });
  if (exists.used) return res.status(400).json({ message: 'Ce code a déjà voté.' });
  return res.json({ ok: true });
});

// Soumettre un vote
app.post('/api/vote', (req, res) => {
  const { voterId, selections } = req.body || {};
  if (!voterId || !selections) return res.status(400).json({ message: 'Requête invalide.' });

  const { candidates, voters, votes } = loadData();
  const voter = voters.voters.find(v => v.id === voterId);
  if (!voter) return res.status(400).json({ message: 'Code électeur introuvable.' });
  if (voter.used) return res.status(400).json({ message: 'Ce code a déjà voté.' });

  // Validation: un choix par poste, candidat existant
  const positionsSet = new Set(candidates.positions.map(p=>p.id));
  for (const [positionId, candidateId] of Object.entries(selections)) {
    if (!positionsSet.has(positionId)) return res.status(400).json({ message: `Poste invalide: ${positionId}` });
    const ok = candidates.candidates.some(c => c.id === candidateId && c.positionId === positionId);
    if (!ok) return res.status(400).json({ message: `Candidat invalide pour ${positionId}` });
  }

  const record = {
    id: nanoid(12),
    voterId,
    selections,
    ts: new Date().toISOString(),
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
  };
  votes.votes.push(record);
  saveVotes(votes);

  // Marquer le code comme utilisé
  voter.used = true;
  saveVoters(voters);

  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────────────
// Admin — Résultats & Export
// ────────────────────────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  if ((req.query.key || '') !== ADMIN_KEY) return res.status(401).send('Unauthorized');
  const { candidates, votes } = loadData();
  const totals = tally(candidates, votes);

  const rows = [];
  for (const pos of candidates.positions) {
    const cands = candidates.candidates.filter(c=>c.positionId===pos.id);
    for (const c of cands) {
      const count = (totals[pos.id] && totals[pos.id][c.id]) || 0;
      rows.push(`<tr><td>${pos.label}</td><td>${c.name}</td><td>${count}</td></tr>`);
    }
  }

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin ESR — Résultats</title>
  <style>body{font-family:Inter,system-ui;padding:20px;background:#0f172a;color:#f8fafc} table{width:100%;border-collapse:collapse;margin-top:10px} td,th{border:1px solid rgba(255,255,255,.1);padding:8px} .muted{color:#9ca3af}</style>
  </head><body>
  <h2>Résultats en temps réel</h2>
  <p class="muted">Clé valide. Votants: ${votes.votes.length}</p>
  <a href="/admin/export.csv?key=${ADMIN_KEY}"><button>Télécharger CSV</button></a>
  <table><thead><tr><th>Poste</th><th>Candidat</th><th>Votes</th></tr></thead><tbody>
  ${rows.join('')}
  </tbody></table>
  </body></html>`);
});

app.get('/admin/export.csv', (req, res) => {
  if ((req.query.key || '') !== ADMIN_KEY) return res.status(401).send('Unauthorized');
  const { candidates, votes } = loadData();
  const totals = tally(candidates, votes);
  let csv = 'poste,candidat,votes\n';
  for (const pos of candidates.positions) {
    const cands = candidates.candidates.filter(c=>c.positionId===pos.id);
    for (const c of cands) {
      const count = (totals[pos.id] && totals[pos.id][c.id]) || 0;
      csv += `"${pos.label}","${c.name}",${count}\n`;
    }
  }
  res.header('Content-Type', 'text/csv');
  res.attachment('resultats_esr.csv');
  res.send(csv);
});

// ────────────────────────────────────────────────────────────────────────────────
// (Optionnel) Clôture automatique par horaire
// ────────────────────────────────────────────────────────────────────────────────
let CLOSE_AT = null; // ex: '2025-09-28T23:59:00+01:00'
app.post('/admin/close-at', (req, res) => {
  if ((req.query.key || '') !== ADMIN_KEY) return res.status(401).json({ message: 'Unauthorized' });
  const { isoDate } = req.body || {};
  CLOSE_AT = isoDate || null;
  res.json({ ok: true, CLOSE_AT });
});
app.get('/api/status', (req, res) => {
  res.json({ CLOSE_AT });
});
app.use((req, res, next) => {
  if (CLOSE_AT) {
    try { if (new Date() > new Date(CLOSE_AT)) return res.status(423).send('Vote clôturé.'); } catch(e){}
  }
  next();
});

// ────────────────────────────────────────────────────────────────────────────────
// Lancer serveur
// ────────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ESR Vote en ligne prêt sur http://localhost:${PORT}`);
  console.log('Vue admin: /admin?key=VOTRE_CLE');
});
