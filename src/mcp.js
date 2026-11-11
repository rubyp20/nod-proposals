// MCP server (Streamable HTTP transport, stateless, JSON responses).
// This is the plug between the customer's own Claude and the app.
// There is no AI in here: every tool only reads from or writes to the database.

import { APP_NAME, json, totals, money, prettyDate } from "./util.js";
import {
  listNotes,
  getNote,
  saveNote,
  listProposals,
  getProposal,
  createProposal,
  updateProposal,
} from "./db.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, authorization",
};

const sectionSchema = {
  type: "array",
  description:
    "Body sections in reading order, for example Understanding of your needs, Scope of work, Deliverables, Timeline, Why us.",
  items: {
    type: "object",
    properties: {
      heading: { type: "string" },
      body: {
        type: "string",
        description: "Plain text. Use blank lines between paragraphs, '- ' for bullets, '1. ' for steps.",
      },
    },
    required: ["heading", "body"],
  },
};

const itemSchema = {
  type: "array",
  description: "Pricing table rows. Use prices from the rate card unless the user says otherwise.",
  items: {
    type: "object",
    properties: {
      description: { type: "string" },
      quantity: { type: "number", description: "Defaults to 1." },
      unit: { type: "string", description: "Optional, for example 'hours', 'months', 'fixed'." },
      unit_price: { type: "number", description: "Price per unit, a plain number without currency symbol." },
    },
    required: ["description", "unit_price"],
  },
};

const proposalProps = {
  title: { type: "string", description: "Short title, for example 'Website redesign for Acme Fitness'." },
  client_name: { type: "string", description: "The person the proposal is addressed to." },
  client_company: { type: "string" },
  client_email: { type: "string" },
  intro: { type: "string", description: "A short opening addressed to the client. 2 to 4 sentences." },
  sections: sectionSchema,
  line_items: itemSchema,
  currency: { type: "string", description: "ISO code such as USD, INR, GBP. Defaults to the business currency." },
  tax_label: { type: "string", description: "For example GST or VAT. Defaults to the business setting." },
  tax_rate: { type: "number", description: "Percent, for example 18. Defaults to the business setting." },
  valid_until: { type: "string", description: "Date the offer expires, as YYYY-MM-DD." },
  terms: { type: "string", description: "Payment and other terms. Defaults to the business standard terms." },
};

const TOOLS = [
  {
    name: "get_business_profile",
    title: "Get business profile and rate card",
    description:
      "Returns the user's business name, description, currency, tax setting, rate card and standard terms. Call this before drafting or pricing a proposal so the prices and terms match what the business actually charges.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_notes",
    title: "List client notes",
    description:
      "Lists the notes the user has saved in the app (for example call notes), newest first, with a short preview. Optionally filter by client name.",
    inputSchema: {
      type: "object",
      properties: { client: { type: "string", description: "Optional text to match in the client name or note title." } },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_note",
    title: "Read a client note",
    description: "Returns the full text of one saved note.",
    inputSchema: { type: "object", properties: { note_id: { type: "string" } }, required: ["note_id"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "save_note",
    title: "Save a client note",
    description:
      "Saves a new note in the app, for example a summary of a client call the user just described. Use only when the user asks to save notes.",
    inputSchema: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["client_name", "body"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "list_proposals",
    title: "List proposals",
    description:
      "Lists the user's proposals with status (draft, sent, viewed, accepted), client, total and view count. Useful to check what a client has opened or accepted, or to find a past proposal to reuse.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "sent", "viewed", "accepted"] },
        client: { type: "string", description: "Optional text to match in the client name, company or title." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_proposal",
    title: "Read a proposal",
    description:
      "Returns the full content of one proposal, including sections, pricing and tracking. Use it to reuse a past proposal's structure or wording.",
    inputSchema: { type: "object", properties: { proposal_id: { type: "string" } }, required: ["proposal_id"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_proposal",
    title: "Create a draft proposal",
    description:
      "Creates a new DRAFT proposal in the app from content you have written. The client cannot see it until the user reviews it in the app and publishes it. After calling, give the user the edit_url so they can review, edit and publish.",
    inputSchema: {
      type: "object",
      properties: proposalProps,
      required: ["title", "client_name", "sections", "line_items"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "update_proposal",
    title: "Update a proposal",
    description:
      "Changes fields of an existing proposal that has not been accepted. Only the fields you pass are changed. Passing sections or line_items replaces the whole list.",
    inputSchema: {
      type: "object",
      properties: { proposal_id: { type: "string" }, ...proposalProps },
      required: ["proposal_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function summary(p, origin, wsId) {
  const t = totals(p.items, p.tax_rate);
  return {
    proposal_id: p.id,
    title: p.title,
    client_name: p.client_name,
    client_company: p.client_company,
    status: p.status,
    total: money(t.total, p.currency),
    valid_until: p.valid_until || null,
    view_count: p.view_count,
    last_viewed_at: p.last_viewed_at || null,
    accepted_at: p.accepted_at || null,
    accepted_by: p.accepted_name || null,
    edit_url: `${origin}/w/${wsId}/p/${p.id}`,
    client_url: p.status === "draft" ? null : `${origin}/p/${p.public_token}`,
    updated_at: p.updated_at,
  };
}

function fromArgs(args) {
  const f = { ...args };
  if (args.line_items !== undefined) f.items = args.line_items;
  delete f.line_items;
  delete f.proposal_id;
  return f;
}

async function callTool(name, args, ctx) {
  const { db, ws, origin } = ctx;
  switch (name) {
    case "get_business_profile":
      return {
        business_name: ws.name,
        owner_name: ws.owner_name || null,
        about: ws.about || null,
        currency: ws.currency,
        tax: ws.tax_rate ? { label: ws.tax_label || "Tax", rate_percent: ws.tax_rate } : null,
        rate_card: ws.rate_card || "(No rate card saved yet. Ask the user for prices.)",
        standard_terms: ws.terms || null,
        today: new Date().toISOString().slice(0, 10),
      };
    case "list_notes": {
      const notes = await listNotes(db, ws.id, args.client ? String(args.client) : "");
      return {
        notes: notes.map((n) => ({
          note_id: n.id,
          client_name: n.client_name,
          title: n.title,
          preview: n.body.slice(0, 200),
          updated_at: n.updated_at,
        })),
      };
    }
    case "get_note": {
      const n = await getNote(db, ws.id, String(args.note_id || ""));
      if (!n) throw new Error("No note with that id. Call list_notes to see the ids.");
      return { note_id: n.id, client_name: n.client_name, title: n.title, body: n.body, updated_at: n.updated_at };
    }
    case "save_note": {
      if (!String(args.body || "").trim()) throw new Error("The note body is empty.");
      const id = await saveNote(db, ws.id, null, args);
      return { note_id: id, saved: true, notes_url: `${origin}/w/${ws.id}/notes/${id}` };
    }
    case "list_proposals": {
      let list = await listProposals(db, ws.id);
      if (args.status) list = list.filter((p) => p.status === args.status);
      if (args.client) {
        const q = String(args.client).toLowerCase();
        list = list.filter((p) => `${p.client_name} ${p.client_company} ${p.title}`.toLowerCase().includes(q));
      }
      return { proposals: list.map((p) => summary(p, origin, ws.id)) };
    }
    case "get_proposal": {
      const p = await getProposal(db, ws.id, String(args.proposal_id || ""));
      if (!p) throw new Error("No proposal with that id. Call list_proposals to see the ids.");
      return {
        ...summary(p, origin, ws.id),
        client_email: p.client_email,
        intro: p.intro,
        sections: p.sections,
        line_items: p.items,
        currency: p.currency,
        tax_label: p.tax_label,
        tax_rate: p.tax_rate,
        terms: p.terms,
      };
    }
    case "create_proposal": {
      if (!String(args.title || "").trim()) throw new Error("A title is required.");
      const p = await createProposal(db, ws, fromArgs(args), "claude");
      return {
        ...summary(p, origin, ws.id),
        message: `Draft saved. The client cannot see it yet. Ask the user to review, edit and publish it at the edit_url. Offer valid until ${
          p.valid_until ? prettyDate(p.valid_until) : "not set"
        }.`,
      };
    }
    case "update_proposal": {
      const id = String(args.proposal_id || "");
      const before = await getProposal(db, ws.id, id);
      if (!before) throw new Error("No proposal with that id. Call list_proposals to see the ids.");
      if (before.status === "accepted") throw new Error("This proposal was accepted by the client and is locked.");
      const p = await updateProposal(db, ws.id, id, fromArgs(args));
      return { ...summary(p, origin, ws.id), message: "Proposal updated." };
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handleMessage(msg, ctx) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    // A response from the client (we never send requests), or malformed input.
    if (msg && msg.id !== undefined && msg.method === undefined) return null;
    return rpcError(msg?.id, -32600, "Invalid request");
  }
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  const params = msg.params || {};
  switch (msg.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nod-proposals", title: `${APP_NAME} proposals`, version: "1.0.0" },
        instructions: `${APP_NAME} stores proposals for ${ctx.ws.name}. To draft a proposal: call get_business_profile for the rate card and terms, read any relevant notes with list_notes and get_note, optionally look at a past proposal for structure, then write the proposal yourself and save it with create_proposal. Proposals are saved as drafts. Always give the user the edit_url so they can review and publish it.`,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${params.name}`);
      try {
        const data = await callTool(params.name, params.arguments || {}, ctx);
        return rpcResult(msg.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          isError: false,
        });
      } catch (err) {
        return rpcResult(msg.id, {
          content: [{ type: "text", text: String(err?.message || err) }],
          isError: true,
        });
      }
    }
    case "resources/list":
      return rpcResult(msg.id, { resources: [] });
    case "prompts/list":
      return rpcResult(msg.id, { prompts: [] });
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(request, ctx) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") {
    // No server-initiated stream and no sessions: only POST is supported.
    return new Response("Method not allowed", { status: 405, headers: { allow: "POST, OPTIONS", ...CORS } });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400, CORS);
  }
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    if (!replies.length) return new Response(null, { status: 202, headers: CORS });
    return json(replies, 200, CORS);
  }
  const reply = await handleMessage(body, ctx);
  if (!reply) return new Response(null, { status: 202, headers: CORS });
  return json(reply, 200, CORS);
}
