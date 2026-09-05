// POST /api/sync — trigger the nightly Firestore -> Postgres load.
// GET  /api/sync/status — the last few runs.
//
// This endpoint reads every school's data and writes to your warehouse, so
// it is protected by a shared secret (SYNC_TOKEN) rather than the app's
// normal staff check — the caller is a scheduler, not a signed-in teacher.
'use strict';

const express = require('express');
const { runSync } = require('../sync/runSync');
const db = require('../db');

const router = express.Router();

// A sync is long-running and rewrites shared rows, so only one at a time.
// NOTE: this guard is per-process. If you ever run more than one instance,
// move it to a Postgres advisory lock (pg_try_advisory_lock).
let inFlight = null;

function requireSyncToken(req, res, next) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'Sync is not configured (SYNC_TOKEN is unset).' });
  }
  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-sync-token');
  if (provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing sync token.' });
  }
  next();
}

router.post('/sync', requireSyncToken, async (req, res) => {
  if (inFlight) {
    return res.status(409).json({ error: 'A sync is already running.', startedAt: inFlight.startedAt });
  }

  const full = req.query.full === 'true' || req.body?.full === true;
  const school = req.query.school || req.body?.school || null;

  // Long syncs outlive a normal HTTP timeout, so kick it off and return the
  // run id immediately. Poll /api/sync/status for the outcome.
  const wait = req.query.wait === 'true';
  inFlight = { startedAt: new Date() };

  const job = runSync({ triggeredBy: 'endpoint', full, school })
    .then(result => { inFlight = null; return result; })
    .catch(err => { inFlight = null; throw err; });

  if (!wait) {
    job.catch(err => console.error('[sync] failed:', err.message));
    return res.status(202).json({ accepted: true, full, school, note: 'Poll /api/sync/status for the result.' });
  }

  try {
    const result = await job;
    return res.status(200).json(result);
  } catch (err) {
    console.error('[sync] failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/sync/status', requireSyncToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, started_at, finished_at, status, triggered_by,
              docs_read, rows_written, rows_skipped, error
       FROM sync_runs ORDER BY started_at DESC LIMIT 10`);
    return res.json({ running: !!inFlight, runs: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
