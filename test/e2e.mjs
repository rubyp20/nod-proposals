// End-to-end check against a running instance (default: local `wrangler dev`).
// Usage: BASE=http://127.0.0.1:8787 node test/e2e.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const form = (o) => new URLSearchParams(o);
const post = (path, body) => fetch(BASE + path, { method: "POST", body: form(body), redirect: "manual" });
let step = 0;
const ok = (msg) => console.log(`  ok ${++step}  ${msg}`);

// 1. Landing and signup
let r = await fetch(BASE + "/");
assert.equal(r.status, 200);
assert.match(await r.text(), /Create your workspace/);
ok("landing page loads");

r = await post("/signup", { name: "Northlight <Studio>", owner_name: "Asha Rao", samples: "1" });
assert.equal(r.status, 303);
const wsPath = r.headers.get("location").split("?")[0];
const key = wsPath.split("/")[2];
assert.ok(key.length >= 20);
ok("signup creates a workspace with a long random key");

r = await fetch(BASE + wsPath);
let body = await r.text();
assert.equal(r.status, 200);
assert.match(body, /Northlight &lt;Studio&gt;/);
assert.doesNotMatch(body, /<Studio>/);
ok("dashboard loads and escapes HTML in names");

// 2. MCP via the official SDK client
const client = new Client({ name: "e2e", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/${key}`)));
ok(`MCP initialize succeeds (server: ${client.getServerVersion().name})`);

const { tools } = await client.listTools();
assert.deepEqual(
  tools.map((t) => t.name).sort(),
  ["create_proposal", "get_business_profile", "get_note", "get_proposal", "list_notes", "list_proposals", "save_note", "update_proposal"]
);
ok("MCP lists 8 tools");

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  return { res, data: res.structuredContent };
};

let { data: profile } = await call("get_business_profile");
assert.match(profile.rate_card, /Website design/);
ok("get_business_profile returns the rate card");

let { data: notes } = await call("list_notes", { client: "acme" });
assert.equal(notes.notes.length, 1);
let { data: note } = await call("get_note", { note_id: notes.notes[0].note_id });
assert.match(note.body, /Priya Menon/);
ok("list_notes and get_note return the sample note");

let { data: created } = await call("create_proposal", {
  title: "Website redesign for Acme Fitness",
  client_name: "Priya Menon",
  client_company: "Acme Fitness",
  client_email: "priya@example.com",
  intro: "Thanks for the call, Priya.\n\nHere is our plan.",
  sections: [
    { heading: "Scope of work", body: "- New mobile-first site\n- Online booking\n\n**Launch** before studio four opens." },
    { heading: "<script>alert(1)</script>", body: "<img src=x onerror=alert(1)>" },
  ],
  line_items: [
    { description: "Website design (up to 8 pages)", unit_price: 3500 },
    { description: "Monthly retainer", quantity: 3, unit: "months", unit_price: 1500 },
  ],
  tax_label: "GST",
  tax_rate: 18,
  valid_until: "2026-12-15",
});
assert.equal(created.status, "draft");
assert.equal(created.client_url, null);
assert.equal(created.total, "$9,440.00"); // (3500 + 4500) * 1.18
const pid = created.proposal_id;
ok("create_proposal saves a draft with the right total and no client link");

let { data: updated } = await call("update_proposal", { proposal_id: pid, title: "Website rebuild for Acme Fitness" });
assert.equal(updated.title, "Website rebuild for Acme Fitness");
let { data: full } = await call("get_proposal", { proposal_id: pid });
assert.equal(full.line_items.length, 2);
assert.equal(full.sections.length, 2);
ok("update_proposal changes only the given field");

let bad = await call("get_proposal", { proposal_id: "nope" });
assert.equal(bad.res.isError, true);
ok("tool errors are reported as isError");

// 3. Person edits in the app
r = await fetch(`${BASE}${wsPath}/p/${pid}`);
body = await r.text();
assert.equal(r.status, 200);
assert.match(body, /via Claude|Claude wrote this/);
assert.doesNotMatch(body, /<script>alert\(1\)<\/script>/);
ok("editor shows the Claude draft and does not execute injected HTML");

// Find the public token only after publishing; a draft must not be reachable.
r = await post(`${wsPath}/p/${pid}`, {
  title: "Website rebuild for Acme Fitness",
  client_name: "Priya Menon",
  client_company: "Acme Fitness",
  client_email: "priya@example.com",
  intro: "Edited by a person.",
  sections_json: JSON.stringify([{ heading: "Scope of work", body: "- Edited scope" }]),
  items_json: JSON.stringify([{ description: "Website design", quantity: 1, unit_price: 4000 }]),
  currency: "USD",
  tax_label: "GST",
  tax_rate: "18",
  valid_until: "2026-12-15",
  terms: "50% deposit.",
  then: "publish",
});
assert.equal(r.status, 303);
assert.match(r.headers.get("location"), /m=published/);
ok("person edits and publishes");

let { data: afterEdit } = await call("get_proposal", { proposal_id: pid });
assert.equal(afterEdit.status, "sent");
assert.equal(afterEdit.total, "$4,720.00");
assert.equal(afterEdit.intro, "Edited by a person.");
const clientUrl = new URL(afterEdit.client_url);
ok("Claude sees the person's edits and the client link");

// 4. Client views and accepts
r = await fetch(BASE + clientUrl.pathname);
body = await r.text();
assert.equal(r.status, 200);
assert.match(body, /Accept proposal/);
assert.match(body, /\$4,720\.00/);
ok("client page loads with total and Accept button");

let { data: viewed } = await call("get_proposal", { proposal_id: pid });
assert.equal(viewed.status, "viewed");
assert.equal(viewed.view_count, 1);
ok("view is tracked");

r = await fetch(`${BASE}${wsPath}/p/${pid}/preview`);
assert.equal(r.status, 200);
let { data: afterPreview } = await call("get_proposal", { proposal_id: pid });
assert.equal(afterPreview.view_count, 1);
ok("owner preview does not count as a view");

r = await post(`${clientUrl.pathname}/accept`, { name: "Priya Menon" });
assert.equal(r.status, 303);
r = await fetch(BASE + r.headers.get("location"));
assert.match(await r.text(), /Proposal accepted/);
let { data: accepted } = await call("list_proposals", { status: "accepted" });
assert.equal(accepted.proposals.length, 1);
assert.equal(accepted.proposals[0].accepted_by, "Priya Menon");
ok("client accepts; status and name are recorded");

let locked = await call("update_proposal", { proposal_id: pid, title: "Changed after acceptance" });
assert.equal(locked.res.isError, true);
ok("accepted proposals are locked");

// 5. Isolation and bad links
r = await fetch(`${BASE}/mcp/not-a-real-key-0000000000`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
assert.equal(r.status, 404);
r = await fetch(`${BASE}/w/not-a-real-key-0000000000`);
assert.equal(r.status, 404);
r = await post("/signup", { name: "Other", samples: "" });
const otherKey = r.headers.get("location").split("?")[0].split("/")[2];
r = await fetch(`${BASE}/w/${otherKey}/p/${pid}`);
assert.equal(r.status, 404);
ok("unknown keys are rejected and workspaces cannot read each other's proposals");

// A draft's client link must not work.
const other = new Client({ name: "e2e2", version: "1.0.0" });
await other.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/${otherKey}`)));
const d = (await other.callTool({ name: "create_proposal", arguments: { title: "Draft", client_name: "X", sections: [], line_items: [] } })).structuredContent;
assert.equal(d.client_url, null);
ok("drafts expose no client link");

r = await fetch(`${BASE}/mcp/${key}`);
assert.equal(r.status, 405);
ok("GET on the MCP endpoint returns 405");

await client.close();
await other.close();
console.log(`\nAll ${step} checks passed against ${BASE}`);
