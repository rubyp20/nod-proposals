// Small shared helpers. No external dependencies.

export const APP_NAME = "Nod";

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function randomKey(bytes = 18) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function nowIso() {
  return new Date().toISOString();
}

export function clampText(value, max) {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function toNumber(value, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "SGD", "AED", "CAD"];
export function currencyList() {
  return CURRENCIES;
}
export function cleanCurrency(value, fallback = "USD") {
  const c = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

export function money(amount, currency) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: cleanCurrency(currency),
      maximumFractionDigits: 2,
    }).format(toNumber(amount));
  } catch {
    return `${cleanCurrency(currency)} ${toNumber(amount).toFixed(2)}`;
  }
}

export function cleanDate(value) {
  const s = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function prettyDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return (
    d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

// Normalise the two structured parts of a proposal, whoever sent them.
export function cleanSections(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 20)
    .map((s) => ({
      heading: clampText(s?.heading, 160),
      body: clampText(s?.body, 8000),
    }))
    .filter((s) => s.heading || s.body);
}

export function cleanItems(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 60)
    .map((i) => ({
      description: clampText(i?.description, 400),
      quantity: Math.max(0, toNumber(i?.quantity, 1)),
      unit: clampText(i?.unit, 30),
      unit_price: Math.max(0, toNumber(i?.unit_price, 0)),
    }))
    .filter((i) => i.description);
}

export function totals(items, taxRate) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const rate = Math.min(100, Math.max(0, toNumber(taxRate, 0)));
  const tax = Math.round(subtotal * rate) / 100;
  return { subtotal, tax, total: subtotal + tax, rate };
}

// Very small, safe text renderer: paragraphs, "- " bullets, "1. " lists, **bold**.
export function renderText(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null; // "ul" | "ol"
  let para = [];
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else if (!line) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line.replace(/^#{1,4}\s+/, ""));
    }
  }
  flushPara();
  closeList();
  return out.join("\n");
}

export function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function redirect(location) {
  return new Response(null, { status: 303, headers: { location, "referrer-policy": "no-referrer" } });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}
