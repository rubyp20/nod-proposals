// Nod: a proposals app that runs on the customer's own Claude.
// One Cloudflare Worker serves the web app, the client-facing proposal pages,
// and the MCP endpoint. There are no AI keys or AI calls anywhere in this app.

import { html, json, redirect } from "./util.js";
import * as db from "./db.js";
import { handleMcp } from "./mcp.js";
import {
  landingPage,
  dashboardPage,
  editorPage,
  notesPage,
  noteEditPage,
  settingsPage,
  connectPage,
  publicProposalPage,
  messagePage,
} from "./views.js";

const notFound = (msg = "That page does not exist, or the link is wrong.") =>
  html(messagePage("Not found", msg, { href: "/", label: "Go to the start page" }), 404);

async function formData(request) {
  const out = {};
  try {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  } catch {}
  return out;
}

function parseJsonField(value) {
  try {
    const v = JSON.parse(value || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const FLASH = {
  saved: "Saved.",
  published: "Published. Copy the client link below and send it.",
  unpublished: "Unpublished. The client link is switched off.",
  created: "Workspace created. Bookmark this page: the link is your key.",
  deleted: "Deleted.",
};

async function handleWorkspace(request, env, url, parts) {
  const ws = await db.getWorkspace(env.DB, parts[1]);
  if (!ws) return notFound("This workspace link is not valid.");
  const base = `/w/${ws.id}`;
  const origin = url.origin;
  const flash = FLASH[url.searchParams.get("m")] || "";
  const method = request.method;
  const [, , a, b, c] = parts; // /w/:key/a/b/c

  // Dashboard
  if (!a) {
    if (method !== "GET") return notFound();
    return html(dashboardPage(ws, await db.listProposals(env.DB, ws.id), flash));
  }

  // Proposals
  if (a === "p") {
    if (b === "new" && method === "POST") {
      const p = await db.createProposal(env.DB, ws, { title: "Untitled proposal" }, "manual");
      return redirect(`${base}/p/${p.id}`);
    }
    const p = b ? await db.getProposal(env.DB, ws.id, b) : null;
    if (!p) return notFound("That proposal does not exist. It may have been deleted.");
    if (!c && method === "GET") return html(editorPage(ws, p, origin, flash));
    if (!c && method === "POST") {
      const f = await formData(request);
      await db.updateProposal(env.DB, ws.id, p.id, {
        title: f.title,
        client_name: f.client_name,
        client_company: f.client_company,
        client_email: f.client_email,
        intro: f.intro,
        sections: parseJsonField(f.sections_json),
        items: parseJsonField(f.items_json),
        currency: f.currency,
        tax_label: f.tax_label,
        tax_rate: f.tax_rate,
        valid_until: f.valid_until,
        terms: f.terms,
      });
      if (f.then === "publish") {
        await db.setPublished(env.DB, ws.id, p.id, true);
        return redirect(`${base}/p/${p.id}?m=published`);
      }
      return redirect(`${base}/p/${p.id}?m=saved`);
    }
    if (c === "preview" && method === "GET") {
      return html(publicProposalPage(ws, p, { preview: true, backUrl: `${base}/p/${p.id}` }));
    }
    if (c === "unpublish" && method === "POST") {
      await db.setPublished(env.DB, ws.id, p.id, false);
      return redirect(`${base}/p/${p.id}?m=unpublished`);
    }
    if (c === "delete" && method === "POST") {
      await db.deleteProposal(env.DB, ws.id, p.id);
      return redirect(`${base}?m=deleted`);
    }
    return notFound();
  }

  // Notes
  if (a === "notes") {
    if (!b && method === "GET") return html(notesPage(ws, await db.listNotes(env.DB, ws.id), flash));
    if (b === "new" && method === "GET") {
      return html(noteEditPage(ws, { id: "", client_name: "", title: "", body: "" }, ""));
    }
    if (b === "new" && method === "POST") {
      const id = await db.saveNote(env.DB, ws.id, null, await formData(request));
      return redirect(`${base}/notes/${id}?m=saved`);
    }
    const note = b ? await db.getNote(env.DB, ws.id, b) : null;
    if (!note) return notFound("That note does not exist. It may have been deleted.");
    if (!c && method === "GET") return html(noteEditPage(ws, note, flash));
    if (!c && method === "POST") {
      await db.saveNote(env.DB, ws.id, note.id, await formData(request));
      return redirect(`${base}/notes/${note.id}?m=saved`);
    }
    if (c === "delete" && method === "POST") {
      await db.deleteNote(env.DB, ws.id, note.id);
      return redirect(`${base}/notes?m=deleted`);
    }
    return notFound();
  }

  // Rate card and profile
  if (a === "settings" && !b) {
    if (method === "GET") return html(settingsPage(ws, flash));
    if (method === "POST") {
      await db.updateWorkspace(env.DB, ws.id, await formData(request));
      return redirect(`${base}/settings?m=saved`);
    }
  }

  if (a === "connect" && !b && method === "GET") return html(connectPage(ws, origin));

  return notFound();
}

async function handlePublic(request, env, url, parts) {
  const [, token, action] = parts; // /p/:token/:action
  const p = await db.getProposalByToken(env.DB, token);
  if (!p || p.status === "draft") {
    return html(
      messagePage("This proposal is not available", "The link may be wrong, or the sender has taken it offline. Please ask them for a new link."),
      404
    );
  }
  const ws = await db.getWorkspace(env.DB, p.workspace_id);
  if (!ws) return notFound();

  if (!action && request.method === "GET") {
    const justAccepted = url.searchParams.get("accepted") === "1";
    if (!justAccepted) await db.recordView(env.DB, token);
    return html(publicProposalPage(ws, p, { justAccepted }));
  }
  if (action === "accept" && request.method === "POST") {
    const f = await formData(request);
    if (!String(f.name || "").trim()) return redirect(`/p/${token}`);
    await db.acceptProposal(env.DB, token, f.name);
    return redirect(`/p/${token}?accepted=1`);
  }
  return notFound();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (!env.DB) {
        return html(messagePage("Setup needed", "The database binding (DB) is missing. Check the D1 binding in the Worker settings."), 500);
      }

      // MCP endpoint: /mcp/:workspaceKey
      if (parts[0] === "mcp") {
        await db.ensureSchema(env.DB);
        const ws = parts[1] ? await db.getWorkspace(env.DB, parts[1]) : null;
        if (!ws || parts.length !== 2) {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unknown MCP link. Copy it again from the Connect Claude page." } }, 404);
        }
        return handleMcp(request, { db: env.DB, ws, origin: url.origin });
      }

      if (parts.length === 0 && request.method === "GET") return html(landingPage());
      if (parts[0] === "health") return json({ ok: true });

      await db.ensureSchema(env.DB);

      if (parts[0] === "signup" && parts.length === 1 && request.method === "POST") {
        const f = await formData(request);
        const id = await db.createWorkspace(env.DB, {
          name: f.name,
          ownerName: f.owner_name,
          withSamples: f.samples === "1",
        });
        return redirect(`/w/${id}?m=created`);
      }
      if (parts[0] === "w" && parts.length >= 2 && parts.length <= 5) {
        return await handleWorkspace(request, env, url, parts);
      }
      if (parts[0] === "p" && parts.length >= 2 && parts.length <= 3) {
        return await handlePublic(request, env, url, parts);
      }
      return notFound();
    } catch (err) {
      console.error("Unhandled error", err?.stack || err);
      if (parts[0] === "mcp") {
        return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } }, 500);
      }
      return html(messagePage("Something went wrong", "Please try again in a moment."), 500);
    }
  },
};
