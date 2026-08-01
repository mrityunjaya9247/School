# Architecture Review: AARNA for Multi-School SaaS

## Executive Summary

The current codebase is a **well-built single-school prototype** with impressive feature depth. However, it has **fundamental architectural gaps** that would cause serious problems when onboarding multiple schools with concurrent teachers and parents. This review covers what works, what breaks at scale, and what to prioritize fixing.

---

## What's Working Well ✅

| Strength | Detail |
|---|---|
| **Multi-tenancy data model** | Firestore paths are already school-scoped: `schools/{code}/students`, `schools/{code}/staff`, etc. This is the right foundation. |
| **Feature richness** | Attendance, timetable, care alerts, class reviews, parent portal, emergency broadcasts, AI message rewriting — the product scope is genuinely complete. |
| **AI proxy isolation** | The `/server` LLM proxy is cleanly separated. Config-driven model switching is well done. |
| **Rate limiting** | Basic per-user rate limiting on the AI endpoint exists. |
| **PII awareness** | Logs don't leak student names or message content. Good instinct. |

---

## Critical Issues for Multi-School Use 🔴

### 1. Zero Authentication — The Biggest Problem

> [!CAUTION]
> **There is no authentication whatsoever.** The code comments explicitly say "Firestore only — NO AUTH." Login checks `sess.code` + email against an open Firestore collection with no password, no token, no Firebase Auth.

**What breaks:**
- Any person who knows a school code can log in as any staff member by typing their email
- Any parent email gives full access to that child's data
- All Firestore reads/writes are unauthenticated — anyone with the Firebase config (visible in page source) can read **every school's data** directly via the Firestore REST API
- The AI proxy's `requireStaff` middleware trusts `req.body.staffId` from the client — it's trivially spoofable

**For multi-school SaaS, this is a non-starter.** Schools entrust you with children's personal data. A single data leak could end the business.

**Fix:** Implement Firebase Authentication (email/password + admin SDK verification). Firestore Security Rules must enforce `school_id` tenancy. The AI proxy must verify Firebase ID tokens, not trust client claims.

---

### 2. The 280KB Single-File Frontend

> [!WARNING]
> The entire application — **4,152 lines of HTML, CSS, and JavaScript** — is a single `index.html` file.

**What breaks at scale:**
- **No code splitting:** Every user downloads the entire app including principal views, teacher views, parent views, setup wizard, all modals — ~280KB of uncompressed markup. On Indian school WiFi/mobile, this hurts.
- **No caching strategy:** Every visit re-downloads everything. No service worker, no asset hashing.
- **No component reuse:** UI is built with string template literals (`innerHTML = \`...\``), not a component framework. Adding features means editing a 4,000+ line file.
- **No build pipeline:** No minification, no tree-shaking, no dead code elimination.
- **DOM thrashing:** Every page navigation re-renders massive HTML strings via `innerHTML`. With 500+ students per school, this gets sluggish.

**Note:** `app.jsx` exists but appears to be an **unused alternative React-based version** (uses Tailwind classes, different design). It's not loaded by `index.html`. This is confusing — which is the real app?

---

### 3. Firestore Client-Side Architecture Won't Scale

**Current pattern:**
```
Browser → Firestore directly (no backend for data)
Browser → Express proxy → LLM (only for AI rewrite)
```

**What breaks with multiple schools / concurrent users:**

| Problem | Impact |
|---|---|
| **No Firestore Security Rules** | Without auth, you can't write meaningful rules. Any browser can read/write any school's data. |
| **N+1 query patterns** | `classHealthStats()` fires 30 parallel Firestore reads per class per page load. With 25 classes, that's **750 reads per principal dashboard visit**. Firestore charges per read. |
| **No server-side aggregation** | Attendance percentages, trends, narratives are all computed client-side from raw records. Every page load re-fetches and re-crunches the same data. |
| **`onSnapshot` listeners** | The tag-scan live feed uses Firestore listeners. At 50 concurrent teachers across 5 schools, that's 50 persistent connections querying overlapping data. Firestore charges for every document in every snapshot. |
| **No pagination** | Student lists, attendance records, reviews — all fetched with `getDocs()` (no `limit/startAfter`). A school with 2,000 students will fetch all 2,000 on every page load. |

**Estimated cost:** At 10 schools × 30 teachers × 5 page loads/day, you're looking at **tens of thousands of Firestore reads per day** before you've even added parents. Firestore's free tier is 50K reads/day. You'll hit paid pricing quickly.

---

### 4. No Real Backend

The only server-side code is the AI rewrite proxy. Everything else — attendance marking, student management, class assignment, emergency broadcasts, message logging — happens directly from the browser to Firestore.

**What you can't do without a backend:**
- Send real emails/SMS to parents (Firestore alone can't)
- Trigger background jobs (daily attendance summaries, overdue alert processing)
- Enforce business rules server-side (a teacher shouldn't be able to edit another teacher's class)
- Generate PDF reports
- Handle webhooks from RFID hardware
- Rate-limit Firestore operations per school (quotas, plan enforcement)

---

### 5. In-Memory Rate Limiter

[rateLimiter.js](file:///c:/Users/Admin/Documents/GitHub%20Repos/School/server/src/rateLimiter.js) uses an in-memory `Map()`. The code itself notes this:

> *"Fine for a single-process deploy; swap for a shared store (Redis, etc.) if this server is ever run with more than one instance."*

On Koyeb or any cloud host with auto-scaling, a second instance means rate limits reset. This is minor compared to the auth issue, but it matters.

---

## Moderate Concerns 🟡

### 6. Firebase Config Exposed in Source

```javascript
const FB = {
  apiKey:"AIzaSyBigNdP6OA4aoxzDCqgdk7pjuyD95-NItQ",
  projectId:"student-21577",
  // ...
};
```

Firebase API keys in client code are normal **if** you have proper Security Rules. Without auth and rules, this is an open door to your entire database.

### 7. Session Stored in localStorage as Plain JSON

```javascript
localStorage.setItem('np', JSON.stringify(sess));
```

The session (including role, school code, classIds) is stored as unencrypted JSON. Any user can edit localStorage to escalate their role from `teacher` to `principal` or change their `classIds` to access other classes.

### 8. No Error Boundaries or Offline Handling

If Firestore is unreachable (common on Indian school networks), the entire app shows a blank screen. No offline cache, no retry logic, no degraded mode.

### 9. Hardcoded Demo Data

`seedSchool()` generates ~550 demo students with hardcoded Indian names. This is fine for demos but will need to be cleanly separated from production flows.

---

## Tech Stack Assessment

| Current Choice | Verdict | Recommendation |
|---|---|---|
| **Single HTML file** | ❌ Not viable | Migrate to React/Next.js (your `nurturepass.txt` spec already says React) |
| **Firestore (client-direct)** | ⚠️ Expensive at scale | Keep Firestore but add a **thin API layer** (Cloud Functions or Express) for writes, aggregations, and auth-gated reads |
| **No auth** | ❌ Dealbreaker | Firebase Auth (email/password) + Firestore Security Rules |
| **Express AI proxy** | ✅ Fine | Extend this into your general API backend |
| **No build system** | ❌ | Vite + React |
| **Vanilla CSS (inline + `<style>`)** | ⚠️ Hard to maintain | Tailwind or CSS Modules via the build system |
| **Cloud-hosted LLM** | ✅ Good move | OpenRouter/Groq/etc. are fine for prod |
| **Koyeb for hosting** | ✅ Viable for the backend | Frontend should go to Vercel/Netlify/Firebase Hosting for CDN + edge caching |

---

## Recommended Migration Priority

### Phase 1 — Security (Week 1-2) 🔐
1. **Add Firebase Authentication** (email/password for staff, magic link for parents)
2. **Write Firestore Security Rules** that enforce per-school tenancy
3. **Verify Firebase ID tokens** in the Express proxy via Firebase Admin SDK
4. **Remove plaintext session from localStorage** — use Firebase Auth's built-in token management

### Phase 2 — Frontend Architecture (Week 3-4) 🏗️
1. **Scaffold a Vite + React app** (you already have `app.jsx` as a starting point)
2. **Break the monolith** into route-based pages with lazy loading
3. **Add a proper auth context** with role-based route guards
4. **Implement loading/error/empty states** for every data-fetching component

### Phase 3 — Backend & Data (Week 5-6) 🗄️
1. **Add Firebase Cloud Functions** (or expand Express) for:
   - Server-side attendance aggregation (precompute daily/weekly stats)
   - Message sending (email/SMS via Twilio, SendGrid)
   - Webhook receiver for RFID hardware
2. **Add Firestore composite indexes** for the queries you're running
3. **Implement pagination** (`limit` + `startAfter`) for student/record lists
4. **Move rate limiting to Redis** (or Upstash for serverless)

### Phase 4 — Performance & Polish (Week 7-8) 🚀
1. **Add a service worker** for offline support
2. **Precompute KPIs** into a `schoolStats/{schoolCode}` doc updated by Cloud Functions
3. **Add monitoring** (Sentry for errors, basic Firestore usage dashboard)
4. **Separate hosting:** CDN for frontend (Vercel), Koyeb/Cloud Run for API

---

## Bottom Line

Your **product vision and feature set are strong** — the spec in `nurturepass.txt` is genuinely thorough, and the working demo proves the concept. But the current implementation is a **prototype architecture** (no auth, monolith HTML, client-direct Firestore) that would be **dangerous and expensive** to onboard real schools on.

The good news: your Firestore data model is already multi-tenant, and your AI proxy is cleanly separated. You're not starting from zero — you're refactoring a working prototype into production architecture.

**Don't try to ship multi-school on the current codebase.** Invest 6-8 weeks in the migration above, and you'll have something you can confidently put in front of school administrators.
