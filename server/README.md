# AI Rewrite proxy

A small standalone server whose only job is: take a teacher's/principal's
short note, ask a locally hosted LLM (Ollama, OpenAI-compatible API) to turn
it into a polished parent message, and hand the draft back. **It never sends
anything** — the AARNA dashboard's existing "Log & Send" flow still owns that,
untouched.

This exists because the dashboard itself ([../index.html](../index.html)) is
a single static HTML file with no backend and no auth of its own — see its
own `Firestore only — NO AUTH` comment. This proxy is genuinely new
infrastructure added just for this feature; nothing else in the project
depends on it.

## Why a separate server at all

The dashboard can't call Ollama directly and still satisfy "one config source,
no code changes to switch models" — that config (base URL, model, timeout,
prompt) needs a place to live outside the browser. This server is that place.
It also means model/API-key details never appear in view-source of the
dashboard.

## Run it

```bash
cd server
npm install
cp .env.example .env        # then edit if your defaults differ
npm start                   # listens on :8787 by default
```

Separately, install and run the model this expects by default:

```bash
ollama pull qwen3:4b
ollama serve                # usually already running as a background service
```

Then open the dashboard as usual (e.g. `python -m http.server 8000` from the
repo root) and use "Improve with AI" in the message composer. If the origin
you serve the dashboard from isn't `http://localhost:8000`, update
`ALLOWED_ORIGINS` in `server/.env` **and** `AI_CONFIG.apiBase` in
`index.html` if the proxy itself isn't on `localhost:8787`.

## Feature flag

Two independent switches, both must be on for the button to actually work:

- `AI_CONFIG.enabled` in `index.html` — purely cosmetic, hides the button/
  toggles in the UI without even calling the server.
- `AI_REWRITE_ENABLED` in `server/.env` (or `config/llm.config.json`'s
  `enabled`, which the env var overrides) — the real switch. When false, the
  endpoint returns `404 {"error":"AI rewrite is disabled"}` without touching
  Ollama at all.

Turning the feature off in production = flip `AI_REWRITE_ENABLED=false` and
restart the proxy. No redeploy of the dashboard needed.

## Switching models

Edit **only** `server/config/llm.config.json` (or the matching env vars) —
never the code:

```json
{ "model": "qwen3:4b" }
```

Other models known to work with Ollama's OpenAI-compatible endpoint:

```bash
ollama pull gemma3:4b     # then set "model": "gemma3:4b"
ollama pull llama3.2:3b   # then set "model": "llama3.2:3b"
```

## Known limitation: this endpoint's "auth" is trust-based, like the rest of the app

The dashboard has no real login tokens to verify — `sess` is a client-side-
only object. `src/staffAuth.js` mirrors that exact same trust level (checks
that the request claims a `teacher`/`principal` role and a `staffId`) rather
than inventing stronger auth just for this one feature. It is **not**
cryptographic verification and a malicious client could lie about its role.
If you want real server-verified auth later, the upgrade path is: pull in the
Firebase Admin SDK here and check `staffId` against the school's `staff`
collection before calling `next()` in `staffAuth.js`.

## Manual test checklist

No automated test framework exists in this project, so verify by hand
(matches how the rest of this project has been verified so far):

1. **Health check** — `curl http://localhost:8787/health` → `{"ok":true,...}`.
2. **Missing auth** — POST without `staffId`/`role` → `401`.
3. **Empty text** — POST with `text:""` → `400`.
4. **Too long** — POST with >1000 chars → `400`.
5. **Disabled flag** — set `AI_REWRITE_ENABLED=false`, restart, POST a valid
   request → `404 {"error":"AI rewrite is disabled"}`.
6. **LLM unreachable** — stop Ollama (or leave it stopped), POST a valid
   request → `503 {"error":"AI temporarily unavailable"}`, and in the
   dashboard UI: the textarea keeps the teacher's original text and an inline
   notice appears instead of a blocked send button.
7. **Happy path (English)** — with Ollama running, POST
   `{"staffId":"x","role":"teacher","code":"DEMO-01","text":"ravi absent tmrw fever pls note","language":"English","tone":"friendly"}`
   → a clear, polite English paragraph, no `<think>` tags, no invented dates/
   names.
8. **Happy path (Hindi)** — same but `"language":"Hindi"` → natural
   Devanagari, not transliterated English.
9. **Hallucination check** — send a deliberately sparse note (e.g. "fees due")
   with no amount or date, and confirm the draft does **not** invent a
   specific amount or due date that wasn't in the note.
10. **Rate limit** — fire >20 requests for the same `staffId` inside a
    minute → later ones return `429`.

Example curl for step 7/8 once Ollama is running:

```bash
curl -X POST http://localhost:8787/api/ai/rewrite \
  -H "Content-Type: application/json" \
  -d '{"staffId":"staff-t1","role":"teacher","code":"DEMO-01","text":"ravi absent tmrw fever pls note","language":"English","tone":"friendly"}'
```

## Keep a backup of the model weights

`ollama pull` downloads several GB per model into Ollama's local storage.
Re-downloading after a disk wipe is slow — back up Ollama's model directory
(or at least note which models/tags you rely on) alongside your usual backups.
