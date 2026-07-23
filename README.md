# Social Media Lead Collector

An interactive, bilingual (**English / Dari**) web app for collecting real
estate leads from your social media profiles. Put the link in your Instagram /
Facebook / TikTok / Telegram bio, and viewers submit their details through a
short conversational form instead of DMing you one by one. Every lead is
scored, stored, and viewable in a password-protected admin dashboard.

## What it does

- **Interactive multi-step form** — the visitor picks what they want, then
  answers a few tailored questions. Mobile-first, since social traffic is mostly phones.
- **Three lead types**
  - 🏠 **Buying** — property type, area, budget, financing, timeline
  - 💰 **Selling** — property type, area, asking price, status, timeline
  - 💬 **General inquiry** — subject + message
- **Automatic lead qualifying** — each lead is scored **Hot / Warm / Cold**
  from the answers (near-term timeline + clear budget/cash = hot), so you know
  who to call first.
- **English ⇄ Dari toggle** — one tap switches the entire form. Dari renders
  right-to-left. The choice is remembered on the visitor's device.
- **Admin dashboard** (`/admin`) — see every lead, filter by type / score /
  status, move leads through a pipeline (New → Contacted → Won / Lost), and
  **export to CSV** (opens cleanly in Excel with Dari text intact).

## Quick start

```bash
npm install
ADMIN_PASSWORD=your-strong-password npm start
```

Then open:

- Public form: <http://localhost:3000/>
- Admin dashboard: <http://localhost:3000/admin>

If you don't set `ADMIN_PASSWORD`, a temporary one is printed in the console
each time the server starts. Set it (see `.env.example`) for a stable login.

## Linking it to your social media

1. Deploy the app somewhere with a public URL (see **Deploying** below).
2. Copy that URL (e.g. `https://leads.yourdomain.com`).
3. Paste it into your **link in bio** on Instagram, TikTok, Facebook, YouTube,
   Telegram, etc. If you use a link-hub (Linktree, etc.), add it as a button
   like "📩 Submit your inquiry".
4. You can point different profiles at the same link — the dashboard records
   the referring page in the lead's `source` field so you can tell where each
   lead came from.

## Configuration

All settings are environment variables (all optional — see `.env.example`):

| Variable         | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `PORT`           | Port to listen on (default `3000`).                            |
| `ADMIN_PASSWORD` | Password for `/admin`. Set this for a stable login.            |
| `DATA_DIR`       | Where the SQLite database file is stored (default `./data`).   |
| `SESSION_SECRET` | Signs admin session tokens (defaults to one derived from the password). |

## Customizing the questions and text

Everything the visitor sees — the questions, answer options, and **all English
and Dari translations** — lives in one file:

**`src/config.js`**

Each label is written as `{ en: '...', fa: '...' }`. To change a question,
add an option, or fix a translation, edit it there; the form and the
server-side validation both read from the same place. To adapt the lead
scoring (what counts as a "hot" lead), edit the `scoreLead` function in the
same file.

Want to rebrand it? Change `config.brand.name` and `config.brand.tagline`.

## How the data is stored

Leads are saved in a local **SQLite** database (`data/leads.db`) — no external
database or account required. Back it up by copying that file. It is excluded
from git so real lead data never gets committed.

## Deploying

The app is a plain Node.js server with no build step, so it runs anywhere that
runs Node 18+:

- **A small VPS** (DigitalOcean, Hetzner, etc.): `npm install`, set
  `ADMIN_PASSWORD`, and run with a process manager like `pm2`, behind Nginx +
  HTTPS.
- **A container host** (Render, Railway, Fly.io): point it at this repo, set
  the `ADMIN_PASSWORD` environment variable, and use `npm start` as the start
  command. Attach a persistent volume and set `DATA_DIR` to it so the database
  survives redeploys.

> **Note on serverless platforms** (e.g. Vercel/Netlify functions): those have
> ephemeral, read-only filesystems, so the SQLite file wouldn't persist. Use a
> host with a normal/persistent disk, or swap `src/db.js` for a hosted database.

## Project structure

```
server.js          Express server: public API, admin API, CSV export, auth
src/config.js      Form flow + all EN/Dari copy + lead-scoring rules
src/db.js          SQLite storage layer
public/
  index.html       Public lead form shell
  app.js           Form logic (renders from /api/config, EN/Dari, validation)
  admin.html       Admin dashboard (login, table, filters, status, export)
  style.css        Shared styles (mobile-first, RTL-aware, dark theme)
```

## Security notes

- The admin dashboard is protected by `ADMIN_PASSWORD`; login issues a signed,
  expiring (12h) token. Always run behind HTTPS in production.
- Submissions are validated on the server (required fields, length caps) — the
  client never decides what's valid.
- There is no built-in rate limiting. If you get spam, put it behind a
  reverse proxy with rate limiting or add a CAPTCHA to the submit step.
