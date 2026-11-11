// Data access for Cloudflare D1 (SQLite). Tables are created on first use,
// so there is no separate migration step when deploying.

import {
  randomKey,
  nowIso,
  clampText,
  cleanCurrency,
  cleanDate,
  cleanSections,
  cleanItems,
  toNumber,
} from "./util.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS workspaces (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     owner_name TEXT NOT NULL DEFAULT '',
     email TEXT NOT NULL DEFAULT '',
     about TEXT NOT NULL DEFAULT '',
     currency TEXT NOT NULL DEFAULT 'USD',
     tax_label TEXT NOT NULL DEFAULT '',
     tax_rate REAL NOT NULL DEFAULT 0,
     rate_card TEXT NOT NULL DEFAULT '',
     terms TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS notes (
     id TEXT PRIMARY KEY,
     workspace_id TEXT NOT NULL,
     client_name TEXT NOT NULL DEFAULT '',
     title TEXT NOT NULL DEFAULT '',
     body TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS notes_ws ON notes (workspace_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS proposals (
     id TEXT PRIMARY KEY,
     workspace_id TEXT NOT NULL,
     public_token TEXT NOT NULL UNIQUE,
     title TEXT NOT NULL DEFAULT '',
     client_name TEXT NOT NULL DEFAULT '',
     client_company TEXT NOT NULL DEFAULT '',
     client_email TEXT NOT NULL DEFAULT '',
     intro TEXT NOT NULL DEFAULT '',
     sections TEXT NOT NULL DEFAULT '[]',
     items TEXT NOT NULL DEFAULT '[]',
     currency TEXT NOT NULL DEFAULT 'USD',
     tax_label TEXT NOT NULL DEFAULT '',
     tax_rate REAL NOT NULL DEFAULT 0,
     valid_until TEXT NOT NULL DEFAULT '',
     terms TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'draft',
     created_via TEXT NOT NULL DEFAULT 'manual',
     view_count INTEGER NOT NULL DEFAULT 0,
     first_viewed_at TEXT,
     last_viewed_at TEXT,
     sent_at TEXT,
     accepted_at TEXT,
     accepted_name TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS proposals_ws ON proposals (workspace_id, updated_at)`,
];

let schemaReady = null;
export function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// ---------- workspaces ----------

const SAMPLE_RATE_CARD = `Discovery workshop (half day): 600
Brand strategy and positioning: 2,400 fixed
Website design (up to 8 pages): 3,500 fixed
Website build and launch: 4,200 fixed
Monthly retainer (content + support, 20 hours): 1,500 per month
Additional hours: 85 per hour`;

const SAMPLE_TERMS = `- 50% deposit to start, 50% on delivery.
- Two rounds of revisions are included in each fixed-price item.
- Work outside the agreed scope is quoted separately before it starts.
- This proposal is valid until the date shown above.`;

const SAMPLE_NOTE = `Call with Priya Menon, founder of Acme Fitness (3 studios in Bengaluru).

- Current website is 5 years old, not mobile friendly, bookings happen over WhatsApp.
- Wants online class booking and membership sign-up on the site.
- Launching a 4th studio in about 10 weeks and wants the new site live before that.
- Brand feels dated. Open to a refresh but wants to keep the logo.
- Budget: mentioned "around 10k" but flexible for the right plan.
- After launch she wants someone to keep content updated monthly.
- Decision maker is Priya. Wants a proposal by Friday.`;

export async function createWorkspace(db, { name, ownerName, withSamples }) {
  const id = randomKey(18);
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO workspaces (id, name, owner_name, currency, rate_card, terms, created_at)
       VALUES (?, ?, ?, 'USD', ?, ?, ?)`
    )
    .bind(
      id,
      clampText(name, 120) || "My business",
      clampText(ownerName, 120),
      withSamples ? SAMPLE_RATE_CARD : "",
      withSamples ? SAMPLE_TERMS : "",
      ts
    )
    .run();
  if (withSamples) {
    await saveNote(db, id, null, {
      client_name: "Acme Fitness",
      title: "Discovery call",
      body: SAMPLE_NOTE,
    });
  }
  return id;
}

export function getWorkspace(db, id) {
  if (!id || id.length < 12 || id.length > 64) return Promise.resolve(null);
  return db.prepare(`SELECT * FROM workspaces WHERE id = ?`).bind(id).first();
}

export async function updateWorkspace(db, id, f) {
  await db
    .prepare(
      `UPDATE workspaces SET name = ?, owner_name = ?, email = ?, about = ?, currency = ?,
         tax_label = ?, tax_rate = ?, rate_card = ?, terms = ? WHERE id = ?`
    )
    .bind(
      clampText(f.name, 120) || "My business",
      clampText(f.owner_name, 120),
      clampText(f.email, 200),
      clampText(f.about, 2000),
      cleanCurrency(f.currency),
      clampText(f.tax_label, 30),
      Math.min(100, Math.max(0, toNumber(f.tax_rate, 0))),
      clampText(f.rate_card, 8000),
      clampText(f.terms, 4000),
      id
    )
    .run();
}

// ---------- notes ----------

export async function listNotes(db, wsId, client) {
  const rows = (
    await db
      .prepare(`SELECT * FROM notes WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 200`)
      .bind(wsId)
      .all()
  ).results;
  if (!client) return rows;
  const q = client.toLowerCase();
  return rows.filter((n) => (n.client_name + " " + n.title).toLowerCase().includes(q));
}

export function getNote(db, wsId, id) {
  return db.prepare(`SELECT * FROM notes WHERE id = ? AND workspace_id = ?`).bind(id, wsId).first();
}

export async function saveNote(db, wsId, id, f) {
  const ts = nowIso();
  const client = clampText(f.client_name, 160);
  const title = clampText(f.title, 200) || "Notes";
  const body = clampText(f.body, 20000);
  if (id) {
    await db
      .prepare(
        `UPDATE notes SET client_name = ?, title = ?, body = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`
      )
      .bind(client, title, body, ts, id, wsId)
      .run();
    return id;
  }
  const newId = "n_" + randomKey(9);
  await db
    .prepare(
      `INSERT INTO notes (id, workspace_id, client_name, title, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(newId, wsId, client, title, body, ts, ts)
    .run();
  return newId;
}

export async function deleteNote(db, wsId, id) {
  await db.prepare(`DELETE FROM notes WHERE id = ? AND workspace_id = ?`).bind(id, wsId).run();
}

// ---------- proposals ----------

function hydrate(row) {
  if (!row) return null;
  let sections = [];
  let items = [];
  try {
    sections = JSON.parse(row.sections || "[]");
  } catch {}
  try {
    items = JSON.parse(row.items || "[]");
  } catch {}
  return { ...row, sections, items };
}

export async function listProposals(db, wsId) {
  const rows = (
    await db
      .prepare(`SELECT * FROM proposals WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 200`)
      .bind(wsId)
      .all()
  ).results;
  return rows.map(hydrate);
}

export async function getProposal(db, wsId, id) {
  return hydrate(
    await db.prepare(`SELECT * FROM proposals WHERE id = ? AND workspace_id = ?`).bind(id, wsId).first()
  );
}

export async function getProposalByToken(db, token) {
  if (!token || token.length < 12 || token.length > 64) return null;
  return hydrate(await db.prepare(`SELECT * FROM proposals WHERE public_token = ?`).bind(token).first());
}

// Fields a person or Claude may set. `ws` supplies defaults for a new proposal.
function proposalFields(f, base) {
  const pick = (key, max) => (f[key] === undefined ? base[key] : clampText(f[key], max));
  return {
    title: pick("title", 200) || "Untitled proposal",
    client_name: pick("client_name", 160),
    client_company: pick("client_company", 160),
    client_email: pick("client_email", 200),
    intro: pick("intro", 6000),
    sections: f.sections === undefined ? base.sections : cleanSections(f.sections),
    items: f.items === undefined ? base.items : cleanItems(f.items),
    currency: f.currency === undefined ? base.currency : cleanCurrency(f.currency, base.currency),
    tax_label: pick("tax_label", 30),
    tax_rate:
      f.tax_rate === undefined ? base.tax_rate : Math.min(100, Math.max(0, toNumber(f.tax_rate, 0))),
    valid_until: f.valid_until === undefined ? base.valid_until : cleanDate(f.valid_until),
    terms: pick("terms", 6000),
  };
}

export async function createProposal(db, ws, f, createdVia) {
  const id = "p_" + randomKey(9);
  const token = randomKey(18);
  const ts = nowIso();
  const v = proposalFields(f, {
    title: "",
    client_name: "",
    client_company: "",
    client_email: "",
    intro: "",
    sections: [],
    items: [],
    currency: ws.currency,
    tax_label: ws.tax_label,
    tax_rate: ws.tax_rate,
    valid_until: "",
    terms: ws.terms,
  });
  await db
    .prepare(
      `INSERT INTO proposals (id, workspace_id, public_token, title, client_name, client_company,
         client_email, intro, sections, items, currency, tax_label, tax_rate, valid_until, terms,
         status, created_via, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    )
    .bind(
      id,
      ws.id,
      token,
      v.title,
      v.client_name,
      v.client_company,
      v.client_email,
      v.intro,
      JSON.stringify(v.sections),
      JSON.stringify(v.items),
      v.currency,
      v.tax_label,
      v.tax_rate,
      v.valid_until,
      v.terms,
      createdVia === "claude" ? "claude" : "manual",
      ts,
      ts
    )
    .run();
  return getProposal(db, ws.id, id);
}

export async function updateProposal(db, wsId, id, f) {
  const current = await getProposal(db, wsId, id);
  if (!current) return null;
  if (current.status === "accepted") return current; // accepted proposals are locked
  const v = proposalFields(f, current);
  await db
    .prepare(
      `UPDATE proposals SET title = ?, client_name = ?, client_company = ?, client_email = ?,
         intro = ?, sections = ?, items = ?, currency = ?, tax_label = ?, tax_rate = ?,
         valid_until = ?, terms = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`
    )
    .bind(
      v.title,
      v.client_name,
      v.client_company,
      v.client_email,
      v.intro,
      JSON.stringify(v.sections),
      JSON.stringify(v.items),
      v.currency,
      v.tax_label,
      v.tax_rate,
      v.valid_until,
      v.terms,
      nowIso(),
      id,
      wsId
    )
    .run();
  return getProposal(db, wsId, id);
}

export async function setPublished(db, wsId, id, published) {
  const ts = nowIso();
  if (published) {
    await db
      .prepare(
        `UPDATE proposals SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ?
         WHERE id = ? AND workspace_id = ? AND status = 'draft'`
      )
      .bind(ts, ts, id, wsId)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE proposals SET status = 'draft', updated_at = ?
         WHERE id = ? AND workspace_id = ? AND status IN ('sent', 'viewed')`
      )
      .bind(ts, id, wsId)
      .run();
  }
}

export async function deleteProposal(db, wsId, id) {
  await db.prepare(`DELETE FROM proposals WHERE id = ? AND workspace_id = ?`).bind(id, wsId).run();
}

export async function recordView(db, token) {
  const ts = nowIso();
  await db
    .prepare(
      `UPDATE proposals SET view_count = view_count + 1,
         first_viewed_at = COALESCE(first_viewed_at, ?), last_viewed_at = ?,
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
       WHERE public_token = ? AND status IN ('sent', 'viewed', 'accepted')`
    )
    .bind(ts, ts, token)
    .run();
}

export async function acceptProposal(db, token, name) {
  const ts = nowIso();
  const res = await db
    .prepare(
      `UPDATE proposals SET status = 'accepted', accepted_at = ?, accepted_name = ?, updated_at = ?
       WHERE public_token = ? AND status IN ('sent', 'viewed')`
    )
    .bind(ts, clampText(name, 160), ts, token)
    .run();
  return res.meta.changes > 0;
}
