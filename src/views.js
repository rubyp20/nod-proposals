// Server-rendered HTML pages. Everything user-supplied goes through esc().

import { CSS } from "./styles.js";
import {
  APP_NAME,
  esc,
  money,
  totals,
  prettyDate,
  prettyDateTime,
  renderText,
  currencyList,
} from "./util.js";

function page(title, body, { bare = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231c7a4f'/%3E%3Cpath d='M9 16.5l4.5 4.5L23 11.5' fill='none' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body${bare ? ' class="bare"' : ""}>
${body}
<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  var text = b.getAttribute('data-copy');
  var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1400); };
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); }); }
  else { window.prompt('Copy this:', text); }
});
document.addEventListener('submit', function (e) {
  var m = e.target.getAttribute('data-confirm');
  if (m && !window.confirm(m)) e.preventDefault();
});
</script>
</body>
</html>`;
}

function shell(ws, active, title, content) {
  const base = `/w/${esc(ws.id)}`;
  const tab = (key, href, label) => `<a href="${base}${href}" class="${active === key ? "on" : ""}">${label}</a>`;
  return page(
    `${title} · ${APP_NAME}`,
    `<header class="top"><div class="wrap">
      <a class="brand" href="${base}"><i>✓</i>${APP_NAME}</a>
      <span class="ws">${esc(ws.name)}</span>
      <nav class="tabs">
        ${tab("proposals", "", "Proposals")}
        ${tab("notes", "/notes", "Notes")}
        ${tab("settings", "/settings", "Rate card")}
        ${tab("connect", "/connect", "Connect Claude")}
      </nav>
    </div></header>
    <main><div class="wrap">${content}</div></main>`
  );
}

const STATUS_LABEL = { draft: "Draft", sent: "Sent", viewed: "Viewed", accepted: "Accepted" };
const chip = (status) => `<span class="chip ${esc(status)}">${STATUS_LABEL[status] || esc(status)}</span>`;

function claudeLink(prompt) {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

// ---------- landing ----------

export function landingPage() {
  return page(
    `${APP_NAME}: proposals your own Claude writes`,
    `<header class="top"><div class="wrap"><span class="brand"><i>✓</i>${APP_NAME}</span></div></header>
    <main><div class="wrap">
      <section class="hero">
        <h1>From call notes to a client-ready proposal link in two minutes.</h1>
        <p>Your own Claude writes the proposal. ${APP_NAME} keeps it live: you edit it, your client opens a link and clicks Accept, and you see when they do.</p>
      </section>
      <div class="how">
        <div class="card"><b>1. Ask Claude</b>"Draft a proposal for Acme from my call notes." Claude reads your notes and rate card from ${APP_NAME}.</div>
        <div class="card"><b>2. Review and publish</b>The draft lands here. Change any word or price, then publish to get a client link.</div>
        <div class="card"><b>3. Get the nod</b>Your client reads it on any device and accepts in one click. You see every view.</div>
      </div>
      <div class="card" style="max-width:560px;margin:0 auto">
        <h2 style="font-size:19px;margin-bottom:14px">Create your workspace</h2>
        <form method="post" action="/signup">
          <div class="field"><label for="name">Business name</label><input type="text" id="name" name="name" required maxlength="120" placeholder="Northlight Studio"></div>
          <div class="field"><label for="owner">Your name</label><input type="text" id="owner" name="owner_name" maxlength="120" placeholder="Asha Rao"></div>
          <div class="field"><label style="font-weight:400"><input type="checkbox" name="samples" value="1" checked> Start with a sample rate card and one sample client note</label></div>
          <button class="btn primary" type="submit">Create workspace</button>
          <p class="hint">No password. You get a private workspace link. Keep it safe, because anyone with the link can open the workspace.</p>
        </form>
      </div>
      <p class="foot">There is no AI inside ${APP_NAME}. All writing is done by the Claude you already use, connected through MCP.</p>
    </div></main>`
  );
}

// ---------- dashboard ----------

export function dashboardPage(ws, proposals, flash) {
  const base = `/w/${esc(ws.id)}`;
  const count = (s) => proposals.filter((p) => p.status === s).length;
  const acceptedValue = {};
  for (const p of proposals.filter((p) => p.status === "accepted")) {
    acceptedValue[p.currency] = (acceptedValue[p.currency] || 0) + totals(p.items, p.tax_rate).total;
  }
  const won = Object.entries(acceptedValue)
    .map(([cur, v]) => money(v, cur))
    .join(" + ");
  const rows = proposals
    .map((p) => {
      const t = totals(p.items, p.tax_rate);
      const activity =
        p.status === "accepted"
          ? `Accepted by ${esc(p.accepted_name || "client")} · ${prettyDateTime(p.accepted_at)}`
          : p.view_count
          ? `${p.view_count} view${p.view_count === 1 ? "" : "s"} · last ${prettyDateTime(p.last_viewed_at)}`
          : p.status === "draft"
          ? "Not published"
          : "Not opened yet";
      return `<tr>
        <td><a class="title" href="${base}/p/${esc(p.id)}">${esc(p.title)}</a>
          ${p.created_via === "claude" ? ' <span class="chip claude">via Claude</span>' : ""}
          <div class="hint" style="margin:2px 0 0">${esc([p.client_name, p.client_company].filter(Boolean).join(", ")) || "No client set"}</div></td>
        <td>${chip(p.status)}</td>
        <td class="hide-sm"><span class="hint">${activity}</span></td>
        <td class="num">${esc(money(t.total, p.currency))}</td>
      </tr>`;
    })
    .join("");
  const table = proposals.length
    ? `<div class="card" style="padding:6px 10px"><table class="list">
        <thead><tr><th>Proposal</th><th>Status</th><th class="hide-sm">Activity</th><th class="num">Total</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<div class="card empty"><h3>No proposals yet</h3>
        <p>Connect Claude, then ask it: <em>"Draft a proposal for Acme Fitness from my notes."</em></p>
        <div class="row" style="justify-content:center;margin-top:12px">
          <a class="btn primary" href="${base}/connect">Connect Claude</a>
          <form method="post" action="${base}/p/new"><button class="btn" type="submit">Start a blank proposal</button></form>
        </div></div>`;
  return shell(
    ws,
    "proposals",
    "Proposals",
    `${flash ? `<div class="banner ok">${esc(flash)}</div>` : ""}
    <div class="head"><div><h1>Proposals</h1><p class="sub">Drafted by your Claude, reviewed and published by you.</p></div>
      <form method="post" action="${base}/p/new"><button class="btn" type="submit">+ Blank proposal</button></form></div>
    <div class="stats">
      <div class="stat"><b>${count("draft")}</b><span>Drafts to review</span></div>
      <div class="stat"><b>${count("sent") + count("viewed")}</b><span>Awaiting client</span></div>
      <div class="stat"><b>${count("accepted")}</b><span>Accepted</span></div>
      <div class="stat"><b>${esc(won || "–")}</b><span>Value accepted</span></div>
    </div>
    ${table}`
  );
}

// ---------- proposal editor ----------

export function editorPage(ws, p, origin, flash) {
  const base = `/w/${esc(ws.id)}`;
  const clientUrl = `${origin}/p/${p.public_token}`;
  const locked = p.status === "accepted";
  const published = p.status !== "draft";
  const dis = locked ? " disabled" : "";
  const curOptions = [...new Set([p.currency, ...currencyList()])]
    .map((c) => `<option value="${esc(c)}"${c === p.currency ? " selected" : ""}>${esc(c)}</option>`)
    .join("");

  let statusBanner = "";
  if (locked) {
    statusBanner = `<div class="banner ok"><strong>Accepted</strong> by ${esc(p.accepted_name || "the client")} on ${prettyDateTime(p.accepted_at)}. This proposal is now locked.</div>`;
  } else if (published) {
    statusBanner = `<div class="banner info"><strong>Published.</strong> ${
      p.view_count
        ? `Opened ${p.view_count} time${p.view_count === 1 ? "" : "s"}, last on ${prettyDateTime(p.last_viewed_at)}.`
        : "Your client has not opened it yet."
    } Edits you save go live immediately.</div>`;
  } else {
    statusBanner = `<div class="banner warn"><strong>Draft.</strong> ${
      p.created_via === "claude" ? "Claude wrote this. " : ""
    }Check the wording and prices, then publish to get a client link.</div>`;
  }

  const share = published
    ? `<div class="card"><label>Client link</label>
        <div class="copy"><input type="text" readonly value="${esc(clientUrl)}" onclick="this.select()">
          <button class="btn" type="button" data-copy="${esc(clientUrl)}">Copy link</button>
          ${
            p.client_email
              ? `<a class="btn" href="mailto:${esc(p.client_email)}?subject=${encodeURIComponent(
                  p.title
                )}&body=${encodeURIComponent(
                  `Hi ${p.client_name || ""},\n\nHere is the proposal we discussed:\n${clientUrl}\n\nYou can accept it directly on that page.\n\n${ws.owner_name || ws.name}`
                )}">Email it</a>`
              : ""
          }</div>
        <p class="hint">Views are counted when someone opens this link. Your own preview does not count.</p></div>`
    : "";

  return shell(
    ws,
    "proposals",
    p.title,
    `${flash ? `<div class="banner ok">${esc(flash)}</div>` : ""}
    <div class="head">
      <div><a href="${base}" class="hint" style="text-decoration:none">← All proposals</a>
        <h1 style="margin-top:4px">${esc(p.title)} ${chip(p.status)}</h1></div>
      <div class="row">
        <a class="btn" href="${base}/p/${esc(p.id)}/preview" target="_blank" rel="noopener">Preview</a>
        ${
          locked
            ? ""
            : published
            ? `<form method="post" action="${base}/p/${esc(p.id)}/unpublish" data-confirm="Unpublish? The client link will stop working until you publish again."><button class="btn" type="submit">Unpublish</button></form>`
            : `<button class="btn primary" type="submit" form="pform" name="then" value="publish">Save and publish</button>`
        }
      </div>
    </div>
    ${statusBanner}
    ${share}
    <form id="pform" method="post" action="${base}/p/${esc(p.id)}" class="card" style="margin-top:16px">
      <fieldset${dis} style="border:0;padding:0;margin:0;min-width:0">
      <div class="field"><label for="title">Title</label><input type="text" id="title" name="title" value="${esc(p.title)}" maxlength="200" required></div>
      <div class="grid g3">
        <div class="field"><label for="cn">Client name</label><input type="text" id="cn" name="client_name" value="${esc(p.client_name)}" maxlength="160"></div>
        <div class="field"><label for="cc">Client company</label><input type="text" id="cc" name="client_company" value="${esc(p.client_company)}" maxlength="160"></div>
        <div class="field"><label for="ce">Client email</label><input type="email" id="ce" name="client_email" value="${esc(p.client_email)}" maxlength="200"></div>
      </div>
      <div class="field"><label for="intro">Opening note</label><textarea id="intro" name="intro" rows="4">${esc(p.intro)}</textarea></div>

      <h3 style="margin:8px 0 10px;font-size:16px">Sections</h3>
      <div id="sections"></div>
      <button class="btn small" type="button" id="addSection">+ Add section</button>

      <h3 style="margin:24px 0 10px;font-size:16px">Pricing</h3>
      <table class="items"><thead><tr><th>Description</th><th style="width:90px">Qty</th><th style="width:110px" class="hide-sm">Unit</th><th style="width:130px">Unit price</th><th style="width:120px" class="num">Amount</th><th style="width:36px"></th></tr></thead>
        <tbody id="items"></tbody></table>
      <button class="btn small" type="button" id="addItem" style="margin-top:6px">+ Add line</button>
      <div class="grid g4" style="margin-top:16px">
        <div><label for="cur">Currency</label><select id="cur" name="currency">${curOptions}</select></div>
        <div><label for="tl">Tax label</label><input type="text" id="tl" name="tax_label" value="${esc(p.tax_label)}" placeholder="GST, VAT" maxlength="30"></div>
        <div><label for="tr">Tax rate %</label><input type="number" id="tr" name="tax_rate" value="${esc(p.tax_rate)}" min="0" max="100" step="0.01"></div>
        <div><label for="vu">Valid until</label><input type="date" id="vu" name="valid_until" value="${esc(p.valid_until)}"></div>
      </div>
      <div class="totals">
        <div><span>Subtotal</span><span id="tSub"></span></div>
        <div id="tTaxRow"><span id="tTaxLabel">Tax</span><span id="tTax"></span></div>
        <div class="grand"><span>Total</span><span id="tTotal"></span></div>
      </div>

      <div class="field" style="margin-top:18px"><label for="terms">Terms</label><textarea id="terms" name="terms" rows="5">${esc(p.terms)}</textarea></div>
      <input type="hidden" name="sections_json" id="sections_json">
      <input type="hidden" name="items_json" id="items_json">
      </fieldset>
      ${
        locked
          ? ""
          : `<div class="sticky"><div class="row" style="justify-content:space-between">
              <button class="btn primary" type="submit">Save changes</button>
              <button class="btn ghost danger" type="submit" form="delform">Delete proposal</button>
            </div></div>`
      }
    </form>
    <form id="delform" method="post" action="${base}/p/${esc(p.id)}/delete" data-confirm="Delete this proposal? This cannot be undone."></form>
    <script type="application/json" id="pdata">${JSON.stringify({ sections: p.sections, items: p.items }).replace(/</g, "\\u003c")}</script>
    <script>
    (function () {
      var data = JSON.parse(document.getElementById('pdata').textContent);
      var locked = ${locked ? "true" : "false"};
      var secBox = document.getElementById('sections');
      var itemBox = document.getElementById('items');
      function el(tag, attrs, kids) {
        var n = document.createElement(tag);
        for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'value') n.value = attrs[k]; else n.setAttribute(k, attrs[k]); }
        (kids || []).forEach(function (c) { n.appendChild(c); });
        return n;
      }
      function addSection(s) {
        var heading = el('input', { type: 'text', placeholder: 'Section heading', value: s.heading || '', maxlength: '160', 'data-k': 'heading' });
        var rm = el('button', { type: 'button', class: 'btn small ghost danger', text: 'Remove' });
        var body = el('textarea', { rows: '6', placeholder: 'Section text. Use "- " for bullet points.', 'data-k': 'body' });
        body.value = s.body || '';
        var box = el('div', { class: 'sec' }, [el('div', { class: 'row' }, [el('div', { style: 'flex:1' }, [heading]), rm]), body]);
        rm.addEventListener('click', function () { box.remove(); });
        secBox.appendChild(box);
      }
      function addItem(i) {
        var d = el('input', { type: 'text', value: i.description || '', placeholder: 'What is included', maxlength: '400', 'data-k': 'description' });
        var q = el('input', { type: 'number', value: i.quantity == null ? 1 : i.quantity, min: '0', step: 'any', 'data-k': 'quantity' });
        var u = el('input', { type: 'text', value: i.unit || '', placeholder: 'fixed', maxlength: '30', 'data-k': 'unit' });
        var pr = el('input', { type: 'number', value: i.unit_price == null ? 0 : i.unit_price, min: '0', step: 'any', 'data-k': 'unit_price' });
        var amt = el('td', { class: 'num' });
        var rm = el('button', { type: 'button', class: 'btn small ghost danger', text: '×', title: 'Remove line' });
        var tr = el('tr', {}, [el('td', {}, [d]), el('td', {}, [q]), el('td', { class: 'hide-sm' }, [u]), el('td', {}, [pr]), amt, el('td', {}, [rm])]);
        rm.addEventListener('click', function () { tr.remove(); recalc(); });
        itemBox.appendChild(tr);
      }
      function fmt(n) {
        var cur = document.getElementById('cur').value || 'USD';
        try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n); }
        catch (e) { return cur + ' ' + n.toFixed(2); }
      }
      function readItems() {
        return Array.prototype.map.call(itemBox.querySelectorAll('tr'), function (tr) {
          var o = {};
          tr.querySelectorAll('[data-k]').forEach(function (inp) { o[inp.getAttribute('data-k')] = inp.value; });
          o.quantity = parseFloat(o.quantity) || 0; o.unit_price = parseFloat(o.unit_price) || 0;
          return o;
        });
      }
      function recalc() {
        var sub = 0;
        Array.prototype.forEach.call(itemBox.querySelectorAll('tr'), function (tr) {
          var q = parseFloat(tr.querySelector('[data-k=quantity]').value) || 0;
          var p = parseFloat(tr.querySelector('[data-k=unit_price]').value) || 0;
          tr.querySelector('td.num').textContent = fmt(q * p);
          sub += q * p;
        });
        var rate = parseFloat(document.getElementById('tr').value) || 0;
        var tax = Math.round(sub * rate) / 100;
        document.getElementById('tSub').textContent = fmt(sub);
        document.getElementById('tTaxRow').style.display = rate ? '' : 'none';
        document.getElementById('tTaxLabel').textContent = (document.getElementById('tl').value || 'Tax') + ' (' + rate + '%)';
        document.getElementById('tTax').textContent = fmt(tax);
        document.getElementById('tTotal').textContent = fmt(sub + tax);
      }
      (data.sections.length ? data.sections : [{ heading: 'Scope of work', body: '' }]).forEach(addSection);
      (data.items.length ? data.items : [{ description: '', quantity: 1, unit_price: 0 }]).forEach(addItem);
      recalc();
      document.getElementById('pform').addEventListener('input', recalc);
      document.getElementById('addSection').addEventListener('click', function () { addSection({}); });
      document.getElementById('addItem').addEventListener('click', function () { addItem({}); recalc(); });
      document.getElementById('pform').addEventListener('submit', function () {
        var secs = Array.prototype.map.call(secBox.querySelectorAll('.sec'), function (b) {
          return { heading: b.querySelector('[data-k=heading]').value, body: b.querySelector('[data-k=body]').value };
        });
        document.getElementById('sections_json').value = JSON.stringify(secs);
        document.getElementById('items_json').value = JSON.stringify(readItems());
      });
    })();
    </script>`
  );
}

// ---------- notes ----------

export function notesPage(ws, notes, flash) {
  const base = `/w/${esc(ws.id)}`;
  const rows = notes
    .map(
      (n) => `<tr>
        <td><a class="title" href="${base}/notes/${esc(n.id)}">${esc(n.title)}</a>
          <div class="hint" style="margin:2px 0 0">${esc(n.body.slice(0, 110))}${n.body.length > 110 ? "…" : ""}</div></td>
        <td>${esc(n.client_name) || '<span class="hint">–</span>'}</td>
        <td class="hide-sm"><span class="hint">${prettyDateTime(n.updated_at)}</span></td>
      </tr>`
    )
    .join("");
  return shell(
    ws,
    "notes",
    "Notes",
    `${flash ? `<div class="banner ok">${esc(flash)}</div>` : ""}
    <div class="head"><div><h1>Notes</h1><p class="sub">Jot down what the client said. Claude reads these when it drafts the proposal.</p></div>
      <a class="btn primary" href="${base}/notes/new">+ New note</a></div>
    ${
      notes.length
        ? `<div class="card" style="padding:6px 10px"><table class="list"><thead><tr><th>Note</th><th>Client</th><th class="hide-sm">Updated</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="card empty"><h3>No notes yet</h3><p>Add notes from a client call, then send them to Claude with one click.</p></div>`
    }`
  );
}

export function noteEditPage(ws, note, flash) {
  const base = `/w/${esc(ws.id)}`;
  const isNew = !note.id;
  const prompt = `Use the ${APP_NAME} connector. Read my note "${note.title}"${
    note.client_name ? ` for ${note.client_name}` : ""
  }, check my rate card, and draft a proposal for this client. Save it to ${APP_NAME} as a draft and give me the link.`;
  return shell(
    ws,
    "notes",
    isNew ? "New note" : note.title,
    `${flash ? `<div class="banner ok">${esc(flash)}</div>` : ""}
    <div class="head"><div><a href="${base}/notes" class="hint" style="text-decoration:none">← All notes</a>
      <h1 style="margin-top:4px">${isNew ? "New note" : esc(note.title)}</h1></div></div>
    ${
      isNew
        ? ""
        : `<div class="card"><div class="row" style="justify-content:space-between">
            <div><strong>Turn this note into a proposal</strong><p class="hint" style="margin-top:2px">Opens your Claude with the request ready. Claude reads this note through the connector.</p></div>
            <div class="row"><a class="btn primary" href="${esc(claudeLink(prompt))}" target="_blank" rel="noopener">Open in Claude</a>
              <button class="btn" type="button" data-copy="${esc(prompt)}">Copy prompt</button></div>
          </div></div>`
    }
    <form method="post" action="${base}/notes/${isNew ? "new" : esc(note.id)}" class="card" style="margin-top:16px">
      <div class="grid g2">
        <div class="field"><label for="client">Client</label><input type="text" id="client" name="client_name" value="${esc(note.client_name)}" maxlength="160" placeholder="Acme Fitness"></div>
        <div class="field"><label for="title">Title</label><input type="text" id="title" name="title" value="${esc(note.title)}" maxlength="200" placeholder="Discovery call"></div>
      </div>
      <div class="field"><label for="body">Notes</label><textarea id="body" name="body" rows="14" placeholder="What they need, timeline, budget, who decides...">${esc(note.body)}</textarea></div>
      <div class="row" style="justify-content:space-between">
        <button class="btn primary" type="submit">Save note</button>
        ${isNew ? "" : `<button class="btn ghost danger" type="submit" form="delnote">Delete note</button>`}
      </div>
    </form>
    ${isNew ? "" : `<form id="delnote" method="post" action="${base}/notes/${esc(note.id)}/delete" data-confirm="Delete this note?"></form>`}`
  );
}

// ---------- settings (rate card) ----------

export function settingsPage(ws, flash) {
  const base = `/w/${esc(ws.id)}`;
  const curOptions = [...new Set([ws.currency, ...currencyList()])]
    .map((c) => `<option value="${esc(c)}"${c === ws.currency ? " selected" : ""}>${esc(c)}</option>`)
    .join("");
  return shell(
    ws,
    "settings",
    "Rate card",
    `${flash ? `<div class="banner ok">${esc(flash)}</div>` : ""}
    <div class="head"><div><h1>Rate card and business profile</h1><p class="sub">Claude reads this before it prices a proposal, so your quotes stay consistent.</p></div></div>
    <form method="post" action="${base}/settings" class="card">
      <div class="grid g3">
        <div class="field"><label for="name">Business name</label><input type="text" id="name" name="name" value="${esc(ws.name)}" maxlength="120" required></div>
        <div class="field"><label for="owner">Your name</label><input type="text" id="owner" name="owner_name" value="${esc(ws.owner_name)}" maxlength="120"></div>
        <div class="field"><label for="email">Contact email</label><input type="email" id="email" name="email" value="${esc(ws.email)}" maxlength="200"></div>
      </div>
      <div class="field"><label for="about">What your business does</label><textarea id="about" name="about" rows="3" placeholder="A two-person studio that designs and builds websites for fitness and wellness brands.">${esc(ws.about)}</textarea></div>
      <div class="grid g3">
        <div class="field"><label for="cur">Default currency</label><select id="cur" name="currency">${curOptions}</select></div>
        <div class="field"><label for="tl">Tax label</label><input type="text" id="tl" name="tax_label" value="${esc(ws.tax_label)}" placeholder="GST, VAT" maxlength="30"></div>
        <div class="field"><label for="tr">Tax rate %</label><input type="number" id="tr" name="tax_rate" value="${esc(ws.tax_rate)}" min="0" max="100" step="0.01"></div>
      </div>
      <div class="field"><label for="rc">Rate card</label><textarea id="rc" name="rate_card" rows="9" placeholder="One service per line with its price.">${esc(ws.rate_card)}</textarea>
        <p class="hint">Free text. One service per line works well, for example "Website design (up to 8 pages): 3,500 fixed".</p></div>
      <div class="field"><label for="terms">Standard terms</label><textarea id="terms" name="terms" rows="6">${esc(ws.terms)}</textarea>
        <p class="hint">Added to every new proposal. You can still change them per proposal.</p></div>
      <button class="btn primary" type="submit">Save</button>
    </form>`
  );
}

// ---------- connect ----------

export function connectPage(ws, origin) {
  const mcpUrl = `${origin}/mcp/${ws.id}`;
  const wsUrl = `${origin}/w/${ws.id}`;
  const prompt = `Use the ${APP_NAME} connector. Read my notes for Acme Fitness, check my rate card, and draft a proposal. Save it to ${APP_NAME} as a draft and give me the link.`;
  return shell(
    ws,
    "connect",
    "Connect Claude",
    `<div class="head"><div><h1>Connect your Claude</h1><p class="sub">${APP_NAME} has no AI inside. Your own Claude does the writing and sends the result here.</p></div></div>
    <div class="card">
      <label>Your MCP link</label>
      <div class="copy"><input type="text" readonly value="${esc(mcpUrl)}" onclick="this.select()"><button class="btn primary" type="button" data-copy="${esc(mcpUrl)}">Copy</button></div>
      <p class="hint">Treat this like a password. Anyone who has it can read and add proposals in this workspace.</p>
    </div>
    <div class="card">
      <h2 style="font-size:17px;margin-bottom:12px">Steps (about one minute)</h2>
      <ol class="steps">
        <li>Open <a href="https://claude.ai/customize/connectors" target="_blank" rel="noopener">claude.ai → Customize → Connectors</a>.</li>
        <li>Click <strong>Add custom connector</strong>.</li>
        <li>Name it <code>${APP_NAME}</code> and paste the MCP link above as the server URL.</li>
        <li>If Claude asks about sign-in, choose <strong>No sign-in</strong>. Leave the OAuth fields empty. Click <strong>Add</strong>.</li>
        <li>Start a new chat. If the connector is not already on, switch it on from the tools menu in the chat box.</li>
        <li>Ask Claude for a proposal. The first time, Claude asks permission to use each tool. Choose Allow.</li>
      </ol>
    </div>
    <div class="card">
      <h2 style="font-size:17px;margin-bottom:8px">Try it</h2>
      <p style="margin:0 0 12px">${esc(prompt)}</p>
      <div class="row"><a class="btn primary" href="${esc(claudeLink(prompt))}" target="_blank" rel="noopener">Open in Claude</a>
        <button class="btn" type="button" data-copy="${esc(prompt)}">Copy prompt</button></div>
    </div>
    <div class="card">
      <h2 style="font-size:17px;margin-bottom:8px">What Claude can do here</h2>
      <table><tbody>
        <tr><td><code>get_business_profile</code></td><td>Read your rate card, tax setting and standard terms</td></tr>
        <tr><td><code>list_notes</code>, <code>get_note</code>, <code>save_note</code></td><td>Read and save client notes</td></tr>
        <tr><td><code>list_proposals</code>, <code>get_proposal</code></td><td>Check status and views, or reuse a past proposal</td></tr>
        <tr><td><code>create_proposal</code>, <code>update_proposal</code></td><td>Save a draft for you to review. Claude cannot publish or delete.</td></tr>
      </tbody></table>
    </div>
    <div class="card">
      <label>Your workspace link (bookmark this)</label>
      <div class="copy"><input type="text" readonly value="${esc(wsUrl)}" onclick="this.select()"><button class="btn" type="button" data-copy="${esc(wsUrl)}">Copy</button></div>
    </div>`
  );
}

// ---------- client-facing proposal ----------

export function publicProposalPage(ws, p, { preview = false, justAccepted = false, backUrl = "" } = {}) {
  const t = totals(p.items, p.tax_rate);
  const accepted = p.status === "accepted";
  const itemRows = p.items
    .map(
      (i) => `<tr><td>${esc(i.description)}</td>
        <td class="num">${
          i.quantity === 1 && /^fixed$/i.test(i.unit) ? "Fixed" : esc(i.quantity) + (i.unit ? " " + esc(i.unit) : "")
        }</td>
        <td class="num hide-sm">${esc(money(i.unit_price, p.currency))}</td>
        <td class="num">${esc(money(i.quantity * i.unit_price, p.currency))}</td></tr>`
    )
    .join("");
  const sections = p.sections.map((s) => `<h2>${esc(s.heading)}</h2>${renderText(s.body)}`).join("\n");
  const pricing = p.items.length
    ? `<h2>Investment</h2>
      <table class="price"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num hide-sm">Unit price</th><th class="num">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${
          t.rate
            ? `<tr><td colspan="2"></td><td class="num hide-sm"></td><td class="num">Subtotal ${esc(money(t.subtotal, p.currency))}</td></tr>
               <tr><td colspan="2"></td><td class="num hide-sm"></td><td class="num">${esc(p.tax_label || "Tax")} (${esc(t.rate)}%) ${esc(money(t.tax, p.currency))}</td></tr>`
            : ""
        }
        <tr class="grand"><td>Total</td><td></td><td class="hide-sm"></td><td class="num">${esc(money(t.total, p.currency))}</td></tr>
      </tfoot></table>`
    : "";

  let acceptBlock;
  if (accepted) {
    acceptBlock = `<div class="accept"><div class="done"><div class="tick">✓</div><div>
        <h2 style="margin:0 0 2px">${justAccepted ? "Thank you. Proposal accepted." : "Proposal accepted"}</h2>
        <p style="margin:0">Accepted by ${esc(p.accepted_name || "the client")} on ${prettyDateTime(p.accepted_at)}. ${esc(ws.name)} has been notified in their dashboard.</p>
      </div></div></div>`;
  } else if (preview) {
    acceptBlock = `<div class="accept"><h2>Ready to go ahead?</h2><p style="margin:0">Your client will see an Accept button here. It is disabled in preview.</p></div>`;
  } else {
    acceptBlock = `<div class="accept"><h2>Ready to go ahead?</h2>
      <p style="margin:0 0 14px">Type your name and click Accept. ${esc(ws.name)} will see it right away.</p>
      <form method="post" action="/p/${esc(p.public_token)}/accept"><div class="row">
        <div class="grow"><label for="an">Your full name</label><input type="text" id="an" name="name" required maxlength="160" value="${esc(p.client_name)}"></div>
        <button class="btn primary" type="submit" style="padding:10px 22px">Accept proposal</button>
      </div></form></div>`;
  }

  return page(
    `${p.title} · ${ws.name}`,
    `<div class="doc-bg">
      ${
        preview
          ? `<div class="preview-bar"><span class="chip viewed">Preview. Only you can see this. ${p.status === "draft" ? "Not published yet." : ""}</span>${
              backUrl ? `<a class="btn small" href="${esc(backUrl)}">Back to editing</a>` : ""
            }</div>`
          : ""
      }
      <article class="doc">
        <header class="doc-head">
          <div class="from">${esc(ws.name)}</div>
          <h1>${esc(p.title)}</h1>
          <div class="meta">
            ${p.client_name || p.client_company ? `<div>Prepared for<b>${esc([p.client_name, p.client_company].filter(Boolean).join(", "))}</b></div>` : ""}
            ${ws.owner_name ? `<div>Prepared by<b>${esc(ws.owner_name)}</b></div>` : ""}
            <div>Date<b>${prettyDate(p.sent_at || p.created_at)}</b></div>
            ${p.valid_until ? `<div>Valid until<b>${prettyDate(p.valid_until)}</b></div>` : ""}
          </div>
        </header>
        <div class="doc-body">
          ${p.intro ? `<div class="intro">${renderText(p.intro)}</div>` : ""}
          ${sections}
          ${pricing}
          ${p.terms ? `<h2>Terms</h2>${renderText(p.terms)}` : ""}
          ${acceptBlock}
          ${ws.email ? `<p class="hint" style="margin-top:16px">Questions? Write to <a href="mailto:${esc(ws.email)}">${esc(ws.email)}</a>.</p>` : ""}
        </div>
      </article>
      <p class="foot">Sent with ${APP_NAME}</p>
    </div>`,
    { bare: true }
  );
}

export function messagePage(title, message, link) {
  return page(
    title,
    `<header class="top"><div class="wrap"><a class="brand" href="/"><i>✓</i>${APP_NAME}</a></div></header>
    <main><div class="wrap"><div class="card empty"><h3>${esc(title)}</h3><p>${esc(message)}</p>
      ${link ? `<p style="margin-top:12px"><a class="btn" href="${esc(link.href)}">${esc(link.label)}</a></p>` : ""}</div></div></main>`
  );
}
