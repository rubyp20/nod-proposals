# Nod

Proposals written by your own Claude, hosted and tracked here.

Nod has **no AI inside it** and no AI keys. The customer connects the Claude they already pay for through MCP. Claude does the reading and writing. Nod does everything else: it stores the proposal, lets a person edit and publish it, serves it to the client at a link, records views, and captures acceptance.

## How it works

1. The user keeps a rate card and client notes in Nod.
2. In Claude they ask: "Draft a proposal for Acme Fitness from my notes."
3. Claude calls Nod's MCP tools to read the notes and rate card, writes the proposal, and saves it as a draft.
4. The user reviews and edits the draft in Nod, then publishes it.
5. The client opens the link and clicks Accept. Nod records each view and the acceptance.

## MCP tools

| Tool | What it does |
| --- | --- |
| `get_business_profile` | Rate card, tax setting, standard terms |
| `list_notes`, `get_note`, `save_note` | Read and save client notes |
| `list_proposals`, `get_proposal` | Status, views, past proposals to reuse |
| `create_proposal`, `update_proposal` | Save or change a draft. Claude cannot publish or delete. |

The MCP endpoint is `https://<your-app>/mcp/<workspace-key>` (Streamable HTTP, no sign-in; the key in the URL is the credential).

## Stack

- One Cloudflare Worker (plain JavaScript, no runtime dependencies)
- Cloudflare D1 (SQLite) for storage; tables are created on first request
- Server-rendered HTML

## Run locally

```
npm install
npm run dev          # http://127.0.0.1:8787
npm test             # end-to-end checks against the local server
```

## Deploy

```
npx wrangler deploy
```

Wrangler creates the D1 database on the first deploy. You can also connect this repository in the Cloudflare dashboard (Workers & Pages → Create → Import a repository).

## Known limits of this first version

- A workspace is protected by its secret link, not by a password.
- Acceptance records a typed name and time. It is not a legal e-signature.
- No email sending. The user copies the client link or opens their mail app.
