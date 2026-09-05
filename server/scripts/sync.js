#!/usr/bin/env node
// Run the Firestore -> Postgres sync from the command line.
//
//   npm run sync                    incremental (since the last successful run)
//   npm run sync -- --full          re-read everything, ignoring the watermark
//   npm run sync -- --school DEMO-01   just one school
//
// This is what you'd point cron / Task Scheduler at if you'd rather not
// expose the HTTP endpoint:
//   0 22 * * *  cd /path/to/server && npm run sync >> sync.log 2>&1
'use strict';

const { runSync } = require('../src/sync/runSync');
const { describe: describeFs } = require('../src/firestore');
const db = require('../src/db');

const args = process.argv.slice(2);
const full = args.includes('--full');
const schoolIdx = args.indexOf('--school');
const school = schoolIdx !== -1 ? args[schoolIdx + 1] : null;

(async () => {
  const pg = db.describe();
  const fs = describeFs();

  console.log('\n  Firestore -> Postgres sync');
  console.log(`    source   ${fs.projectId || fs.error}`);
  console.log(`    target   ${pg.host}/${pg.database} (schema ${pg.schema})`);
  console.log(`    mode     ${full ? 'FULL — re-reading all history' : 'incremental'}`);
  if (school) console.log(`    school   ${school} only`);
  console.log('');

  const startedAt = Date.now();
  try {
    const r = await runSync({ triggeredBy: 'cli', full, school });
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`  run #${r.runId} — ${r.status} in ${secs}s`);
    console.log(`    documents read  ${r.read}`);
    console.log(`    rows written    ${r.written}`);
    console.log(`    rows skipped    ${r.skipped}`);
    if (r.since) console.log(`    watermark from  ${r.since.toISOString()}`);

    if (r.failed.length) {
      console.log('\n  Schools that failed entirely (rolled back):');
      r.failed.forEach(f => console.log(`    - ${f}`));
    }

    const skips = Object.entries(r.detail).filter(([k]) => k.endsWith('.skipped'));
    if (skips.length) {
      console.log('\n  Skipped documents (first few per school):');
      skips.forEach(([key, notes]) => {
        console.log(`    ${key.replace('.skipped', '')}:`);
        notes.forEach(n => console.log(`      - ${n}`));
      });
      console.log('\n  Skips are usually documents referencing a deleted staff member');
      console.log('  or student. They are counted, not fatal.');
    }

    console.log('');
    await db.close();
    process.exit(r.status === 'failed' ? 1 : 0);

  } catch (err) {
    console.error(`\n  [fail] ${err.message}\n`);
    if (/credential|service account/i.test(err.message)) {
      console.error('  Set FIREBASE_SERVICE_ACCOUNT in .env to your service account JSON.');
      console.error('  Firebase console -> Project settings -> Service accounts -> Generate new private key.\n');
    }
    await db.close().catch(() => {});
    process.exit(1);
  }
})();
