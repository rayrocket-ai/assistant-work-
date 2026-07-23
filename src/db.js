/**
 * SQLite storage for leads. Uses better-sqlite3 (synchronous, no server).
 * The database file lives in ./data/leads.db by default and is created on
 * first run. Nothing else is required to deploy.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'leads.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL,
    intent          TEXT NOT NULL,
    language        TEXT NOT NULL,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    preferred_contact TEXT,
    contact_handle  TEXT,
    score           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'new',
    answers_json    TEXT NOT NULL,
    source          TEXT
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO leads
    (created_at, intent, language, name, phone, preferred_contact,
     contact_handle, score, status, answers_json, source)
  VALUES
    (@created_at, @intent, @language, @name, @phone, @preferred_contact,
     @contact_handle, @score, 'new', @answers_json, @source)
`);

function createLead(lead) {
  const row = {
    created_at: new Date().toISOString(),
    intent: lead.intent,
    language: lead.language || 'en',
    name: lead.name,
    phone: lead.phone,
    preferred_contact: lead.preferredContact || null,
    contact_handle: lead.contactHandle || null,
    score: lead.score,
    answers_json: JSON.stringify(lead.answers || {}),
    source: lead.source || null,
  };
  const info = insertStmt.run(row);
  return getLead(info.lastInsertRowid);
}

const getStmt = db.prepare('SELECT * FROM leads WHERE id = ?');
function getLead(id) {
  const row = getStmt.get(id);
  return row ? hydrate(row) : null;
}

function listLeads({ intent, status, score } = {}) {
  const clauses = [];
  const params = {};
  if (intent) { clauses.push('intent = @intent'); params.intent = intent; }
  if (status) { clauses.push('status = @status'); params.status = status; }
  if (score) { clauses.push('score = @score'); params.score = score; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM leads ${where} ORDER BY id DESC`).all(params);
  return rows.map(hydrate);
}

const VALID_STATUSES = ['new', 'contacted', 'won', 'lost'];
const updateStatusStmt = db.prepare('UPDATE leads SET status = ? WHERE id = ?');
function updateLeadStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) return null;
  updateStatusStmt.run(status, id);
  return getLead(id);
}

function stats() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM leads').get().c;
  const byScore = db.prepare('SELECT score, COUNT(*) AS c FROM leads GROUP BY score').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) AS c FROM leads GROUP BY status').all();
  const byIntent = db.prepare('SELECT intent, COUNT(*) AS c FROM leads GROUP BY intent').all();
  const asMap = (arr, key) => Object.fromEntries(arr.map((r) => [r[key], r.c]));
  return {
    total,
    byScore: asMap(byScore, 'score'),
    byStatus: asMap(byStatus, 'status'),
    byIntent: asMap(byIntent, 'intent'),
  };
}

function hydrate(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    intent: row.intent,
    language: row.language,
    name: row.name,
    phone: row.phone,
    preferredContact: row.preferred_contact,
    contactHandle: row.contact_handle,
    score: row.score,
    status: row.status,
    answers: JSON.parse(row.answers_json),
    source: row.source,
  };
}

module.exports = {
  db,
  createLead,
  getLead,
  listLeads,
  updateLeadStatus,
  stats,
  VALID_STATUSES,
};
