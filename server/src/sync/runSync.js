// The Firestore -> Postgres sync engine.
//
// Design notes:
//
// * Idempotent. Every write is an upsert keyed on the Firestore document id
//   (or a natural key). Running it twice in a row changes nothing the second
//   time, so a retry after a failure is always safe.
//
// * Incremental where it matters. Firestore bills per document read. Reference
//   data (staff, students, classes) is small and re-read in full; append-only
//   collections (attendance, events, messages) are read only from the last
//   successful run's watermark forward. A nightly run therefore costs roughly
//   one day of documents, not the whole history.
//
// * Never fails the whole run over one bad document. A row pointing at a
//   deleted teacher is skipped and counted, not fatal. The run is marked
//   'partial' so you can see it happened.
//
// * Per-school transactions. Each school commits independently, so one
//   school's bad data can't roll back another's good import.
'use strict';

const { getFirestore } = require('../firestore');
const db = require('../db');
const { collections, attendanceRecords } = require('./mappings');

const BATCH = 500;

// --------------------------------------------------------------------------
// SQL helpers
// --------------------------------------------------------------------------

/** Build an idempotent INSERT ... ON CONFLICT DO UPDATE for one row. */
function upsertSql(table, row, conflictCols) {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const updates = cols
    .filter(c => !conflictCols.includes(c))
    .map(c => `${c} = EXCLUDED.${c}`);

  const sql =
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT (${conflictCols.join(', ')}) ` +
    (updates.length ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING') +
    ' RETURNING id';

  return { sql, values: cols.map(c => row[c]) };
}

async function loadIdSet(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return new Set(rows.map(r => r.id));
}

// --------------------------------------------------------------------------
// Firestore readers
// --------------------------------------------------------------------------

function buildQuery(fs, spec, schoolCode, since) {
  const base = spec.root
    ? fs.collection(spec.collection)
    : fs.collection('schools').doc(schoolCode).collection(spec.collection);

  if (spec.mode === 'recent') {
    return base.orderBy(spec.orderBy, 'desc').limit(spec.limit || 1000);
  }
  if (spec.mode === 'incremental' && since) {
    // Date-string fields (attendanceDays.date is 'YYYY-MM-DD') compare
    // lexicographically, which is why ISO format matters here.
    const bound = spec.sinceIsDateString ? since.toISOString().slice(0, 10) : since;
    return base.where(spec.since, '>=', bound);
  }
  return base;
}

// --------------------------------------------------------------------------
// One collection
// --------------------------------------------------------------------------

async function syncCollection(client, fs, spec, ctx, since) {
  const snap = await buildQuery(fs, spec, ctx.schoolId, since).get();
  let written = 0, skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    let row;
    try {
      row = spec.row(data, doc.id, ctx);
    } catch (err) {
      skipped++;
      ctx.notes.push(`${spec.collection}/${doc.id}: transform failed — ${err.message}`);
      continue;
    }
    if (!row) { skipped++; continue; }

    try {
      const { sql, values } = upsertSql(spec.table, row, spec.conflict);
      const { rows: returned } = await client.query(sql, values);
      written++;

      // Embedded arrays (comments[], channels[]) become child rows. They have
      // no ids of their own, so the parent's set is replaced wholesale.
      const parentId = returned[0] && returned[0].id;
      if (spec.children && parentId != null) {
        for (const child of spec.children) {
          if (child.replaceOnParent) {
            await client.query(`DELETE FROM ${child.table} WHERE ${child.parentKey} = $1`, [parentId]);
          }
          for (const childRow of child.rows(data)) {
            const full = { [child.parentKey]: parentId, ...childRow };
            const cols = Object.keys(full);
            await client.query(
              `INSERT INTO ${child.table} (${cols.join(', ')}) ` +
              `VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`,
              cols.map(c => full[c])
            );
          }
        }
      }
    } catch (err) {
      skipped++;
      ctx.notes.push(`${spec.collection}/${doc.id}: ${err.message}`);
    }
  }

  return { read: snap.size, written, skipped };
}

// --------------------------------------------------------------------------
// staff.classIds[] / watchClassIds[] -> join tables.
// Deferred until classes exist, since both sides are foreign keys.
// --------------------------------------------------------------------------

async function linkTeacherClasses(client, staffDocs, ctx) {
  let written = 0;
  await client.query(
    `DELETE FROM teacher_classes WHERE staff_id IN (SELECT id FROM staff WHERE school_id = $1)`,
    [ctx.schoolId]);
  await client.query(
    `DELETE FROM staff_watch_classes WHERE staff_id IN (SELECT id FROM staff WHERE school_id = $1)`,
    [ctx.schoolId]);

  for (const { id: staffId, data } of staffDocs) {
    if (!ctx.staffIds.has(staffId)) continue;

    for (const classId of new Set(data.classIds || [])) {
      if (!ctx.classIds.has(classId)) continue;
      await client.query(
        `INSERT INTO teacher_classes (staff_id, class_id, is_home_room) VALUES ($1,$2,$3)
         ON CONFLICT (staff_id, class_id) DO UPDATE SET is_home_room = EXCLUDED.is_home_room`,
        [staffId, classId, ctx.homeroomOf.get(classId) === staffId]);
      written++;
    }
    for (const classId of new Set(data.watchClassIds || [])) {
      if (!ctx.classIds.has(classId)) continue;
      await client.query(
        `INSERT INTO staff_watch_classes (staff_id, class_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`, [staffId, classId]);
      written++;
    }
  }
  return written;
}

// --------------------------------------------------------------------------
// attendanceDays/{day}/records subcollection
// --------------------------------------------------------------------------

async function syncAttendanceRecords(client, fs, ctx, since) {
  const { rows: days } = await client.query(
    `SELECT id FROM attendance_days WHERE school_id = $1 AND date >= $2 ORDER BY date`,
    [ctx.schoolId, (since || new Date(0)).toISOString().slice(0, 10)]);

  let written = 0, skipped = 0, read = 0;
  for (const { id: dayId } of days) {
    const snap = await fs.collection('schools').doc(ctx.schoolId)
      .collection('attendanceDays').doc(dayId).collection('records').get();
    read += snap.size;

    for (const doc of snap.docs) {
      const row = attendanceRecords.row(doc.data(), dayId, ctx);
      if (!row) { skipped++; continue; }
      try {
        const { sql, values } = upsertSql('attendance_records', row, attendanceRecords.conflict);
        await client.query(sql, values);
        written++;
      } catch (err) {
        skipped++;
        ctx.notes.push(`attendance_records/${dayId}/${doc.id}: ${err.message}`);
      }
    }
  }
  return { read, written, skipped };
}

// --------------------------------------------------------------------------
// One school
// --------------------------------------------------------------------------

async function syncSchool(fs, schoolCode, schoolData, since, detail) {
  return db.withTransaction(async client => {
    const ctx = {
      schoolId: schoolCode,
      academicYear: schoolData.academicYear || '2026-2027',
      campusIds: new Set(), staffIds: new Set(), classIds: new Set(), studentIds: new Set(),
      deviceByGate: new Map(), staffIdByName: new Map(), homeroomOf: new Map(),
      notes: [],
    };
    let read = 0, written = 0, skipped = 0;
    const bump = r => { read += r.read; written += r.written; skipped += r.skipped; };
    const note = (name, r) => {
      detail[`${schoolCode}.${name}`] = { read: r.read, written: r.written, skipped: r.skipped };
    };

    // The school document itself.
    await client.query(
      `INSERT INTO schools (id, name, slug, timezone, academic_year, plan, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, timezone=EXCLUDED.timezone,
         academic_year=EXCLUDED.academic_year, plan=EXCLUDED.plan, is_active=EXCLUDED.is_active`,
      [schoolCode, schoolData.name || schoolCode, schoolData.slug || schoolCode.toLowerCase(),
       schoolData.timezone || 'Asia/Kolkata', ctx.academicYear,
       schoolData.plan || 'basic', schoolData.isActive !== false,
       schoolData.createdAt ? new Date(schoolData.createdAt._seconds * 1000) : new Date()]);
    written++;

    // Cache staff docs — the join tables need them again after classes load.
    let staffDocs = [];

    for (const spec of collections) {
      // Root collections that aren't school-scoped only need one pass overall.
      if (spec.oncePerRun && !detail.__rootDone) continue;

      if (spec.collection === 'staff') {
        const snap = await fs.collection('schools').doc(schoolCode).collection('staff').get();
        staffDocs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
      }

      const result = await syncCollection(client, fs, spec, ctx, since);
      bump(result); note(spec.collection, result);

      // Refresh the id sets as each level lands, so later collections can
      // validate their foreign keys against what actually got written.
      if (spec.collection === 'campuses') {
        ctx.campusIds = await loadIdSet(client, 'SELECT id FROM campuses WHERE school_id=$1', [schoolCode]);
      }
      if (spec.collection === 'staff') {
        ctx.staffIds = await loadIdSet(client, 'SELECT id FROM staff WHERE school_id=$1', [schoolCode]);
        const { rows } = await client.query('SELECT id, name FROM staff WHERE school_id=$1', [schoolCode]);
        // Only map names that identify exactly one person — parent_messages
        // stores a name rather than an id, and duplicates can't be resolved.
        const seen = new Map();
        rows.forEach(r => seen.set(r.name, seen.has(r.name) ? null : r.id));
        seen.forEach((id, name) => { if (id) ctx.staffIdByName.set(name, id); });
      }
      if (spec.collection === 'classes') {
        ctx.classIds = await loadIdSet(client, 'SELECT id FROM classes WHERE school_id=$1', [schoolCode]);
        const { rows } = await client.query(
          'SELECT id, class_teacher_id FROM classes WHERE school_id=$1', [schoolCode]);
        rows.forEach(r => ctx.homeroomOf.set(r.id, r.class_teacher_id));
        written += await linkTeacherClasses(client, staffDocs, ctx);
      }
      if (spec.collection === 'students') {
        ctx.studentIds = await loadIdSet(client, 'SELECT id FROM students WHERE school_id=$1', [schoolCode]);
      }
      if (spec.collection === 'devices') {
        const { rows } = await client.query(
          'SELECT id, gate_label FROM devices WHERE school_id=$1', [schoolCode]);
        rows.forEach(r => ctx.deviceByGate.set(r.gate_label, r.id));
      }
      if (spec.collection === 'attendanceDays') {
        const r = await syncAttendanceRecords(client, fs, ctx, since);
        bump(r); note('attendanceDays.records', r);
      }
    }

    if (ctx.notes.length) {
      detail[`${schoolCode}.skipped`] = ctx.notes.slice(0, 25);   // cap the log size
    }
    return { read, written, skipped };
  });
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

/**
 * @param {object}  opts
 * @param {string}  opts.triggeredBy  'endpoint' | 'cli' | 'schedule' | 'manual'
 * @param {boolean} opts.full         ignore the watermark and re-read everything
 * @param {string}  opts.school       sync only this school code
 */
async function runSync({ triggeredBy = 'manual', full = false, school = null } = {}) {
  const fs = getFirestore();
  const startedAt = new Date();

  // Watermark: start from the last successful run. Overlap by an hour so a
  // document written while the previous run was in flight isn't missed.
  let since = null;
  if (!full) {
    const { rows } = await db.query(
      `SELECT watermark_to FROM sync_runs
       WHERE status IN ('success','partial') ORDER BY started_at DESC LIMIT 1`);
    if (rows.length && rows[0].watermark_to) {
      since = new Date(rows[0].watermark_to.getTime() - 60 * 60 * 1000);
    }
  }

  const { rows: [run] } = await db.query(
    `INSERT INTO sync_runs (triggered_by, watermark_from, watermark_to)
     VALUES ($1,$2,$3) RETURNING id`,
    [triggeredBy, since, startedAt]);

  const detail = { __rootDone: false };
  let read = 0, written = 0, skipped = 0, failed = [];

  try {
    const schoolsSnap = await fs.collection('schools').get();
    const targets = schoolsSnap.docs.filter(d => !school || d.id === school);

    if (!targets.length) {
      throw new Error(school
        ? `No school "${school}" found in Firestore.`
        : 'No schools found in Firestore — check the service account is on the right project.');
    }

    for (const [i, doc] of targets.entries()) {
      detail.__rootDone = i > 0;    // root collections sync once, with the first school
      try {
        const r = await syncSchool(fs, doc.id, doc.data(), since, detail);
        read += r.read; written += r.written; skipped += r.skipped;
      } catch (err) {
        // One school failing rolls back only that school.
        failed.push(`${doc.id}: ${err.message}`);
      }
    }

    delete detail.__rootDone;
    const status = failed.length ? 'partial' : (skipped > 0 ? 'partial' : 'success');
    await db.query(
      `UPDATE sync_runs SET finished_at=now(), status=$1, docs_read=$2, rows_written=$3,
       rows_skipped=$4, detail=$5, error=$6 WHERE id=$7`,
      [status, read, written, skipped, JSON.stringify(detail),
       failed.length ? failed.join('; ') : null, run.id]);

    return { runId: run.id, status, read, written, skipped, since, failed, detail };

  } catch (err) {
    await db.query(
      `UPDATE sync_runs SET finished_at=now(), status='failed', docs_read=$1,
       rows_written=$2, rows_skipped=$3, detail=$4, error=$5 WHERE id=$6`,
      [read, written, skipped, JSON.stringify(detail), err.message, run.id]);
    throw err;
  }
}

module.exports = { runSync };
