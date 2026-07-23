/**
 * Social-media lead collector — Express server.
 *
 * Public endpoints (linked from social bios):
 *   GET  /                     interactive bilingual lead form
 *   GET  /api/config           form flow + translations (drives the client)
 *   POST /api/leads            submit a lead
 *
 * Admin endpoints (password-protected via ADMIN_PASSWORD):
 *   GET  /admin                dashboard UI
 *   POST /api/admin/login      exchange password for a session token
 *   GET  /api/admin/leads      list leads (filterable)
 *   GET  /api/admin/leads.csv  export leads as CSV
 *   GET  /api/admin/stats      summary counts
 *   PATCH /api/admin/leads/:id update a lead's pipeline status
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { config, questionsForIntent, scoreLead } = require('./src/config');
const store = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password: required for the dashboard. If unset, a random one is
// generated and printed on boot so the app never ships with a default secret.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
const ADMIN_PASSWORD_GENERATED = !process.env.ADMIN_PASSWORD;

// Secret used to sign session tokens. Derived from the password so tokens
// stay valid across restarts (as long as the password is stable).
const TOKEN_SECRET = process.env.SESSION_SECRET || `sess:${ADMIN_PASSWORD}`;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

app.use(express.json({ limit: '64kb' }));
app.disable('x-powered-by');

// --- token helpers ----------------------------------------------------------

function signToken(expiresAt) {
  const payload = String(expiresAt);
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(payload) > Date.now();
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!verifyToken(token)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// --- public API -------------------------------------------------------------

app.get('/api/config', (req, res) => {
  res.json({
    brand: config.brand,
    intents: config.intents,
    contactQuestions: config.contactQuestions,
    ui: config.ui,
  });
});

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  const { intent, language, answers } = body;

  const questions = questionsForIntent(intent);
  if (!questions) return res.status(400).json({ error: 'invalid_intent' });
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'missing_answers' });
  }

  // Validate required fields server-side (never trust the client).
  for (const q of questions) {
    if (q.required) {
      const v = answers[q.id];
      if (v === undefined || v === null || String(v).trim() === '') {
        return res.status(400).json({ error: 'missing_field', field: q.id });
      }
    }
  }

  // Cap free-text length defensively.
  for (const key of Object.keys(answers)) {
    if (typeof answers[key] === 'string' && answers[key].length > 2000) {
      answers[key] = answers[key].slice(0, 2000);
    }
  }

  const score = scoreLead(intent, answers);

  const lead = store.createLead({
    intent,
    language: language === 'fa' ? 'fa' : 'en',
    name: String(answers.name || '').trim(),
    phone: String(answers.phone || '').trim(),
    preferredContact: answers.preferredContact || null,
    contactHandle: answers.contactHandle || null,
    score,
    answers,
    source: (req.get('referer') || '').slice(0, 300) || null,
  });

  res.status(201).json({ ok: true, id: lead.id, score: lead.score });
});

// --- admin API --------------------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  const supplied = String((req.body && req.body.password) || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'invalid_password' });
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  res.json({ token: signToken(expiresAt), expiresAt });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(store.stats());
});

app.get('/api/admin/leads', requireAdmin, (req, res) => {
  const { intent, status, score } = req.query;
  res.json(store.listLeads({ intent, status, score }));
});

app.patch('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = String((req.body && req.body.status) || '');
  if (!store.VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  const updated = store.updateLeadStatus(id, status);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

app.get('/api/admin/leads.csv', requireAdmin, (req, res) => {
  const leads = store.listLeads({
    intent: req.query.intent,
    status: req.query.status,
    score: req.query.score,
  });
  const columns = [
    'id', 'created_at', 'intent', 'score', 'status', 'language',
    'name', 'phone', 'preferred_contact', 'contact_handle',
    'property_type', 'area', 'budget', 'financing', 'timeline',
    'asking_price', 'property_status', 'subject', 'message', 'notes', 'source',
  ];
  const cell = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = leads.map((l) => {
    const a = l.answers || {};
    return [
      l.id, l.createdAt, l.intent, l.score, l.status, l.language,
      l.name, l.phone, l.preferredContact, l.contactHandle,
      a.propertyType, a.area, a.budget, a.financing, a.timeline,
      a.askingPrice, a.status, a.subject, a.message, a.notes, l.source,
    ].map(cell).join(',');
  });
  const csv = [columns.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
  res.send('﻿' + csv); // BOM so Excel reads UTF-8 (Dari) correctly
});

// --- static files -----------------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Lead collector running on http://localhost:${PORT}`);
  console.log(`  Public form:      http://localhost:${PORT}/`);
  console.log(`  Admin dashboard:  http://localhost:${PORT}/admin`);
  if (ADMIN_PASSWORD_GENERATED) {
    console.log(`\n  ⚠  No ADMIN_PASSWORD set. Temporary password for this run:`);
    console.log(`     ${ADMIN_PASSWORD}`);
    console.log(`  Set ADMIN_PASSWORD in the environment for a stable password.\n`);
  }
});

module.exports = app;
