#!/usr/bin/env node
// Write the sample schools into Firestore.
//
//   npm run seed:firestore -- --dry-run       show what would be written
//   npm run seed:firestore                    write SMHS-042 and GVN-108
//   npm run seed:firestore -- --include-demo  also (re)write DEMO-01
//   npm run seed:firestore -- --school GVN-108
//
// DEMO-01 is skipped by default on purpose. The app's own seedSchool()
// already builds DEMO-01 with ~550 students across 25 classes; this file's
// version has 5 students, and writing it over the top would leave you with
// a confusing mix of the two. The other two schools are additive and safe.
//
// Every document is written with an explicit id via set(), so re-running
// updates in place instead of piling up duplicates.
'use strict';

const admin = require('firebase-admin');
const { getFirestore } = require('../src/firestore');
const { schools, tagScans, DEMO_CODE } = require('./data/sample-schools');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const includeDemo = args.includes('--include-demo');
const onlyIdx = args.indexOf('--school');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

const { Timestamp } = admin.firestore;
const BATCH_LIMIT = 450;          // Firestore's hard limit is 500 ops

// Recursively convert JS Dates to Firestore Timestamps, including inside
// arrays like classReviews.comments[].
function toFirestore(value) {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFirestore(v)]));
  }
  return value;
}

// Batches writes automatically, committing whenever it fills up.
function createWriter(db) {
  let batch = db.batch();
  let pending = 0;
  let total = 0;

  return {
    async set(ref, data) {
      batch.set(ref, toFirestore(data), { merge: true });
      pending++; total++;
      if (pending >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    },
    async flush() {
      if (pending) await batch.commit();
      return total;
    },
    get total() { return total; },
  };
}

// Sub-collections written under schools/{code}/...
const SUBCOLLECTIONS = [
  'campuses', 'devices', 'staff', 'classes', 'students', 'timetable',
  'staffLogins', 'substitutions', 'events', 'classReviews',
  'subjectRequests', 'announcements', 'emergencyBroadcasts',
  'staffMessages', 'messages', 'careAlerts',
];

async function seedSchool(db, writer, school, counts) {
  const schoolRef = db.collection('schools').doc(school.code);
  await writer.set(schoolRef, school.doc);
  counts.school = (counts.school || 0) + 1;

  for (const name of SUBCOLLECTIONS) {
    const docs = school[name] || {};
    for (const [id, data] of Object.entries(docs)) {
      await writer.set(schoolRef.collection(name).doc(id), data);
    }
    if (Object.keys(docs).length) counts[name] = Object.keys(docs).length;
  }

  // attendanceDays carries a records subcollection under each day.
  let recordCount = 0;
  for (const [dayId, day] of Object.entries(school.attendanceDays || {})) {
    const dayRef = schoolRef.collection('attendanceDays').doc(dayId);
    await writer.set(dayRef, day.doc);
    for (const [recId, rec] of Object.entries(day.records || {})) {
      await writer.set(dayRef.collection('records').doc(recId), rec);
      recordCount++;
    }
  }
  if (Object.keys(school.attendanceDays || {}).length) {
    counts.attendanceDays = Object.keys(school.attendanceDays).length;
    counts['attendanceDays/records'] = recordCount;
  }

  // tagMappings is a ROOT collection (not school-scoped), keyed by student id.
  // schoolCode is what ties each mapping back to its school.
  for (const [studentId, m] of Object.entries(school.tagMappings || {})) {
    await writer.set(db.collection('tagMappings').doc(studentId),
      { studentId, schoolCode: school.code, ...m });
  }
  if (Object.keys(school.tagMappings || {}).length) {
    counts.tagMappings = Object.keys(school.tagMappings).length;
  }
}

(async () => {
  let targets = schools;
  if (only) {
    targets = schools.filter(s => s.code === only);
    if (!targets.length) {
      console.error(`\n  No sample school named "${only}". Available: ${schools.map(s => s.code).join(', ')}\n`);
      process.exit(1);
    }
  } else if (!includeDemo) {
    targets = schools.filter(s => s.code !== DEMO_CODE);
  }

  console.log('\n  Seed Firestore with sample schools');
  console.log(`    schools   ${targets.map(s => s.code).join(', ')}`);
  if (!only && !includeDemo) {
    console.log(`    skipping  ${DEMO_CODE} (your app's seedSchool() owns it — pass --include-demo to override)`);
  }
  console.log(`    mode      ${dryRun ? 'DRY RUN — nothing will be written' : 'WRITING'}`);

  if (dryRun) {
    let planned = 0;
    for (const s of targets) {
      let n = 1;
      for (const c of SUBCOLLECTIONS) n += Object.keys(s[c] || {}).length;
      for (const day of Object.values(s.attendanceDays || {})) n += 1 + Object.keys(day.records || {}).length;
      n += Object.keys(s.tagMappings || {}).length;
      console.log(`      ${s.code.padEnd(10)} ${n} documents`);
      planned += n;
    }
    planned += Object.keys(tagScans).length;
    console.log(`      ${'tags'.padEnd(10)} ${Object.keys(tagScans).length} documents (root)`);
    console.log(`\n  Would write ${planned} documents. Re-run without --dry-run to apply.\n`);
    process.exit(0);
  }

  let db;
  try {
    db = getFirestore();
  } catch (err) {
    console.error(`\n  [fail] ${err.message}`);
    console.error('  Firebase console -> Project settings -> Service accounts -> Generate new private key,');
    console.error('  then point FIREBASE_SERVICE_ACCOUNT in .env at the downloaded JSON.\n');
    process.exit(1);
  }

  const writer = createWriter(db);
  const started = Date.now();

  try {
    for (const school of targets) {
      const counts = {};
      await seedSchool(db, writer, school, counts);
      const summary = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ');
      console.log(`\n    ${school.code}: ${summary}`);
    }

    // Root-level raw scan feed, written once regardless of school selection.
    for (const [id, scan] of Object.entries(tagScans)) {
      await writer.set(db.collection('tags').doc(id), scan);
    }
    console.log(`\n    tags (root): ${Object.keys(tagScans).length} scans`);

    const total = await writer.flush();
    console.log(`\n  Wrote ${total} documents in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    console.log(`\n  Log in to the app with a seeded account, e.g.`);
    targets.forEach(s => {
      const principal = Object.values(s.staff).find(m => m.role === 'principal');
      if (principal) console.log(`    ${s.code.padEnd(10)} ${principal.email}`);
    });
    console.log('');
    process.exit(0);

  } catch (err) {
    console.error(`\n  [fail] ${err.message}`);
    if (/PERMISSION_DENIED/i.test(err.message)) {
      console.error('  The service account lacks Firestore write access. Check its IAM role in the');
      console.error('  Google Cloud console (Cloud Datastore User or Firebase Admin).\n');
    }
    process.exit(1);
  }
})();
