# AARNA — setup

What's in this repo and how to run each piece.

```
public/index.html          the entire frontend (self-contained, ~276KB)
app.jsx                    unused React mockup — not loaded by index.html
server/                    Express: AI rewrite proxy + Firestore→Postgres sync
database_schema.sql        relational schema (25 tables, `school` schema)
sample_data.sql            sample data for Postgres — 3 schools
migrations/                schema changes applied after the base schema
firebase.json              Hosting config — deploys public/ only
```

---

## 1. Run the frontend locally

```
start-server.bat            # Windows
# or:
cd public && python -m http.server 8000
```

Opens at http://localhost:8000/index.html. It talks straight to Firestore —
no backend needed for the app itself.

> Serves `public/` only, not the repo root. That matches what Firebase
> deploys, and keeps `server/.env` unreachable from a browser.

---

## 2. Deploy the frontend to Firebase Hosting

```
npm install -g firebase-tools
firebase login
firebase hosting:channel:deploy preview    # temporary URL, 7-day expiry
firebase deploy --only hosting             # live at student-21577.web.app
```

`firebase hosting:rollback` undoes a bad deploy instantly.

> **Don't run `firebase init hosting`.** It asks for a "public directory"
> and the obvious answer (`.`) would publish `server/.env`, the service
> account key, and every internal doc in this repo — 33 files. `firebase.json`
> already has the right config; go straight to deploy.

**Before deploying for real:** `public/index.html` line 806 hardcodes
`apiBase: 'http://localhost:8787'`. Point it at your deployed backend or the
AI rewrite button fails silently in production.

---

## 3. The backend server

```
cd server
npm install
cp .env.example .env        # then fill it in
npm start                   # listens on :8787
```

Endpoints:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/ai/rewrite` | staff fields in body | polish a parent message |
| POST | `/api/sync` | `Bearer $SYNC_TOKEN` | run the Firestore→Postgres load |
| GET | `/api/sync/status` | `Bearer $SYNC_TOKEN` | last 10 sync runs |
| GET | `/health` | none | process + database reachability |

---

## 3b. The local AI model (Ollama)

The rewrite feature calls an OpenAI-compatible endpoint. By default that's
Ollama on your own machine, so student names and attendance details in the
prompt never leave it.

```
# https://ollama.com/download
ollama pull llama3.2:3b
ollama serve                 # listens on 11434
```

Check it directly before involving the app:

```
curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Say hello"}]}'
```

`llama3.2:3b` is English-only, ~2GB, and answers in roughly 3-5 seconds on a
CPU. Swap `LLM_MODEL` for `gemma3:4b` (better writing, a little slower) or
`phi4-mini` if you want to compare — no code change, they all speak the same
API. A GPU is not required at this size; one only becomes worthwhile if you
add an interactive chatbot, where CPU latency feels broken.

> **Where this runs matters.** Firebase Hosting serves static files only —
> neither Express nor Ollama can run there. Until you deploy the backend
> somewhere reachable, the AI button appears on `localhost` and is hidden on
> the deployed site (see `AI_CONFIG` in index.html: the frontend probes
> `/health` at startup and hides the feature if nothing answers). Everything
> else in the app works either way, because it talks to Firestore directly.
>
> To enable AI on the hosted site: deploy `server/` somewhere with the model
> alongside it (a ~$40/month 8GB box is enough), set `HOSTED_API_BASE` in
> index.html to that URL, and add the same origin to `ALLOWED_ORIGINS` in
> `server/.env`.

---

## 4. Postgres (optional — only for SQL reporting)

The app runs entirely on Firestore. Postgres is a **reporting mirror**, not
a dependency. Skip this section if you only want the app running.

```
# create the schema and load sample rows
psql -h <host> -U <user> -d <db> -f database_schema.sql
psql -h <host> -U <user> -d <db> -f migrations/002_sync_support.sql
psql -h <host> -U <user> -d <db> -f sample_data.sql

cd server
npm run db:check            # verifies connection, reports what it found
```

`db:check` diagnoses failures rather than dumping a stack trace. On AWS RDS a
connection timeout is almost always the security group, not your password —
add an inbound rule for PostgreSQL/5432 from your IP.

For local development set `DB_HOST=localhost` and `DB_SSL=false`; the same
code runs against RDS by changing those two values.

---

## 5. Firestore → Postgres sync

Needs a **service account** — not the public `FB` config in index.html.
Firebase console → Project settings → Service accounts → Generate new private
key. Save it under `server/secrets/` (gitignored) and set
`FIREBASE_SERVICE_ACCOUNT` in `.env`.

```
npm run sync                      # incremental, since the last successful run
npm run sync -- --full            # re-read all history
npm run sync -- --school DEMO-01  # one school
```

Nightly via cron:

```
0 22 * * *  cd /path/to/server && npm run sync >> sync.log 2>&1
```

Or via the endpoint (returns 202, runs in background):

```
curl -X POST https://your-backend/api/sync -H "Authorization: Bearer $SYNC_TOKEN"
```

Reference data is re-read in full each run; append-heavy collections
(attendance, events, messages) only pull documents newer than the last
successful run. Firestore bills per document read, so re-reading all history
nightly gets expensive as attendance accumulates.

Re-running is always safe — every write is an upsert keyed on the Firestore
document id.

---

## 6. Seed Firestore with sample schools

```
cd server
npm run seed:firestore -- --dry-run    # preview, writes nothing
npm run seed:firestore                 # writes SMHS-042 and GVN-108
```

Skips `DEMO-01` by default: the app's own `seedSchool()` already builds it
with ~550 students, and this seeder's 5-student version would leave a
half-and-half roster. `--include-demo` overrides.

Logins created:

| School | Principal |
|---|---|
| SMHS-042 | `principal@smhs-042` |
| GVN-108 | `principal@gvn-108` |

---

## Secrets

`.gitignore` covers `.env`, `secrets/`, and service account key filenames.
Verify before any first push to a new remote:

```
git check-ignore -v server/.env server/secrets/firebase-service-account.json
```

A Firebase service account bypasses every Security Rule on the project. Once
committed it stays in git history even after the file is deleted — the only
real fix is revoking the key.

---

## Known gaps

Both are called out in `architecture_review.md` and neither is fixed yet:

1. **No authentication.** Login checks an email against Firestore with no
   password. Anyone who knows a school code can sign in as any teacher and
   read every child's record. This needs Firebase Auth + Security Rules
   before a production URL goes to a school.
2. **`apiBase` is hardcoded to localhost** in index.html.
