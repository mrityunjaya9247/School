// How each Firestore collection becomes rows in the `school` schema.
//
// Each entry declares:
//   collection  Firestore collection name (under schools/{code}, unless root:true)
//   table       destination table
//   conflict    columns that identify "the same record" for upsert
//   mode        'full'        re-read the whole collection every run. For small,
//                             slowly-changing reference data.
//               'incremental' only read documents newer than the last successful
//                             run's watermark. For append-heavy collections —
//                             Firestore bills per document read, so re-reading
//                             all of history nightly gets expensive fast.
//               'recent'      read the newest N by a field. Used where the
//                             timestamp field's type isn't reliable enough to
//                             range-query on.
//   since       field the incremental watermark compares against
//   row(doc,id,ctx)  -> column object, or null to skip the document
//
// ctx carries the id sets loaded earlier in the run, so a document pointing at
// a staff member or class that no longer exists is skipped or null-ed rather
// than blowing up the whole sync on a foreign key violation.
'use strict';

const { toDate } = require('../firestore');

// Null out a reference that doesn't resolve, so a nullable FK stays valid.
const ref = (set, value) => (value && set.has(value) ? value : null);

const ROLES = new Set(['teacher', 'principal']);
const clampPct = v => (typeof v === 'number' && v >= 0 && v <= 100 ? Math.round(v) : null);
const oneOf = (value, allowed, fallback = null) => (allowed.includes(value) ? value : fallback);

const collections = [

  // ---------- reference data: small, full refresh each run ----------

  {
    collection: 'campuses', table: 'campuses', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => ({
      id, school_id: ctx.schoolId,
      name: d.name || id, address: d.address || null, city: d.city || null,
      is_active: d.isActive !== false,
    }),
  },

  {
    collection: 'devices', table: 'devices', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => ({
      id, school_id: ctx.schoolId,
      campus_id: ref(ctx.campusIds, d.campusId),
      name: d.name || id,
      gate_label: d.gateLabel || d.name || id,
      status: oneOf(d.status, ['online', 'offline'], 'offline'),
      read_quality_percent: clampPct(d.readQualityPercent),
      firmware_version: d.firmwareVersion || null,
      last_heartbeat_at: toDate(d.lastHeartbeatAt),
    }),
  },

  {
    // Loaded before classes, because classes.class_teacher_id points here.
    // The classIds[] / watchClassIds[] arrays are handled separately, after
    // classes exist — see linkTeacherClasses in runSync.js.
    collection: 'staff', table: 'staff', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => {
      if (!d.email) return null;                 // email is NOT NULL and is the login key
      if (!ROLES.has(d.role)) return null;       // 'parent' is a derived role, never stored
      return {
        id, school_id: ctx.schoolId,
        name: d.name || d.email,
        email: d.email,
        role: d.role,
        created_at: toDate(d.createdAt) || new Date(),
      };
    },
  },

  {
    collection: 'classes', table: 'classes', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => ({
      id, school_id: ctx.schoolId,
      campus_id: ref(ctx.campusIds, d.campusId),
      name: d.name || id.replace('class-', ''),
      grade: String(d.grade ?? ''),
      section: String(d.section ?? ''),
      academic_year: d.academicYear || ctx.academicYear,
      class_teacher_id: ref(ctx.staffIds, d.classTeacherId),
    }),
  },

  {
    collection: 'students', table: 'students', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => {
      if (!d.firstName && !d.lastName) return null;
      return {
        id, school_id: ctx.schoolId,
        class_id: ref(ctx.classIds, d.classId),
        campus_id: ref(ctx.campusIds, d.campusId),
        first_name: d.firstName || '',
        last_name: d.lastName || '',
        roll: d.roll || id,
        guardian_name: d.guardianName || null,
        parent_email: d.parentEmail || null,
        parent_phone: d.parentPhone || null,
        photo_url: d.photoUrl || null,
        is_active: d.isActive !== false,
        created_at: toDate(d.createdAt) || new Date(),
      };
    },
  },

  {
    collection: 'timetable', table: 'timetable_slots', conflict: ['id'], mode: 'full',
    row: (d, id, ctx) => {
      if (!ctx.classIds.has(d.classId) || !ctx.staffIds.has(d.teacherId)) return null;
      return {
        id, school_id: ctx.schoolId,
        class_id: d.classId,
        day: d.day, period: d.period,
        start_time: d.start, end_time: d.end,
        subject: d.subject || '',
        teacher_id: d.teacherId,
      };
    },
  },

  {
    // Root-level collection, shared across all schools. Keyed by student id.
    collection: 'tagMappings', table: 'rfid_tag_mappings', conflict: ['student_id'],
    mode: 'full', root: true,
    row: (d, id, ctx) => {
      if (!d.epc) return null;
      if (!ctx.studentIds.has(d.studentId || id)) return null;   // belongs to another school
      return {
        student_id: d.studentId || id,
        school_id: ctx.schoolId,
        class_id: ref(ctx.classIds, d.classId),
        epc: d.epc,
        assigned_at: toDate(d.assignedAt) || new Date(),
      };
    },
  },

  // ---------- event data: grows forever, pulled incrementally ----------

  {
    collection: 'staffLogins', table: 'staff_logins',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'loginAt',
    row: (d, id, ctx) => {
      if (!ctx.staffIds.has(d.staffId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        staff_id: d.staffId,
        role: d.role || 'teacher',
        login_at: toDate(d.loginAt) || new Date(),
        logout_at: toDate(d.logoutAt),
      };
    },
  },

  {
    collection: 'substitutions', table: 'substitutions',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'createdAt',
    row: (d, id, ctx) => {
      if (!ctx.classIds.has(d.classId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        class_id: d.classId,
        date: d.date, day: d.day, period: d.period,
        start_time: d.start, end_time: d.end,
        subject: d.subject || '',
        original_teacher_id: ref(ctx.staffIds, d.originalTeacherId),
        substitute_teacher_id: ref(ctx.staffIds, d.substituteTeacherId),
        status: oneOf(d.status, ['active', 'cancelled'], 'active'),
        created_by: ref(ctx.staffIds, d.createdBy),
        created_at: toDate(d.createdAt) || new Date(),
      };
    },
  },

  {
    // Parent rows only; the records subcollection is pulled per-day in runSync.
    collection: 'attendanceDays', table: 'attendance_days', conflict: ['id'],
    mode: 'incremental', since: 'date', sinceIsDateString: true,
    row: (d, id, ctx) => {
      if (!ctx.classIds.has(d.classId)) return null;
      return {
        id, school_id: ctx.schoolId,
        class_id: d.classId,
        campus_id: ref(ctx.campusIds, d.campusId),
        date: d.date,
        total_students: d.totalStudents ?? 0,
        present_count: d.presentCount ?? 0,
        absent_count: d.absentCount ?? 0,
        late_count: d.lateCount ?? 0,
        is_reconciled: !!d.isReconciled,
        is_locked: !!d.isLocked,
      };
    },
  },

  {
    collection: 'events', table: 'attendance_events',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'scannedAt',
    row: (d, id, ctx) => ({
      source_doc_id: id, school_id: ctx.schoolId,
      // Firestore records the gate label, not a device id — resolve it back.
      device_id: ctx.deviceByGate.get(d.gateLabel) || null,
      campus_id: ref(ctx.campusIds, d.campusId),
      student_id: ref(ctx.studentIds, d.studentId),
      student_name_snapshot: d._studentName || d.studentName || null,
      direction: oneOf(d.direction, ['entry', 'exit', 'unknown'], 'unknown'),
      confidence: oneOf(d.confidence, ['high', 'low'], 'low'),
      scanned_at: toDate(d.scannedAt) || new Date(),
      notification_status: oneOf(d.notificationStatus, ['pending', 'sent', 'failed'], 'pending'),
      is_corrected: !!d.isCorrected,
    }),
  },

  {
    // comments[] is an embedded array — expanded into class_review_comments
    // by the children hook below.
    collection: 'classReviews', table: 'class_reviews',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'createdAt',
    row: (d, id, ctx) => {
      if (!ctx.classIds.has(d.classId) || !ctx.staffIds.has(d.teacherId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        class_id: d.classId,
        teacher_id: d.teacherId,
        created_by: ref(ctx.staffIds, d.createdBy) || d.teacherId,   // created_by is NOT NULL
        health_pct: clampPct(d.healthPct),
        health_status: d.healthStatus || null,
        status: oneOf(d.status, ['pending', 'acknowledged'], 'pending'),
        needs_principal_ack: !!d.needsPrincipalAck,
        principal_ack_at: toDate(d.principalAckAt),
        acknowledged_at: toDate(d.acknowledgedAt),
        created_at: toDate(d.createdAt) || new Date(),
      };
    },
    children: [{
      table: 'class_review_comments',
      parentKey: 'class_review_id',
      // Comments have no stable id of their own, so the whole thread is
      // replaced whenever its review is synced.
      replaceOnParent: true,
      rows: d => (d.comments || []).map(c => ({
        author_role: oneOf(c.by, ['teacher', 'principal'], 'teacher'),
        author_name: c.name || 'Unknown',
        text: c.text || '',
        commented_at: toDate(c.at) || new Date(),
      })),
    }],
  },

  {
    collection: 'subjectRequests', table: 'subject_requests',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'createdAt',
    row: (d, id, ctx) => {
      if (!ctx.classIds.has(d.classId) || !ctx.staffIds.has(d.teacherId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        teacher_id: d.teacherId,
        class_id: d.classId,
        class_teacher_id: ref(ctx.staffIds, d.classTeacherId),
        subject: d.subject || '',
        status: oneOf(d.status, ['pending', 'approved', 'rejected'], 'pending'),
        created_at: toDate(d.createdAt) || new Date(),
        decided_at: toDate(d.decidedAt),
        decided_by: ref(ctx.staffIds, d.decidedBy),
      };
    },
  },

  {
    collection: 'announcements', table: 'announcements',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'createdAt',
    row: (d, id, ctx) => ({
      source_doc_id: id, school_id: ctx.schoolId,
      text: d.text || '',
      created_by: ref(ctx.staffIds, d.createdBy),
      active: d.active !== false,
      created_at: toDate(d.createdAt) || new Date(),
    }),
  },

  {
    collection: 'emergencyBroadcasts', table: 'emergency_broadcasts',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'sentAt',
    row: (d, id, ctx) => ({
      source_doc_id: id, school_id: ctx.schoolId,
      scope: oneOf(d.scope, ['teachers', 'all'], 'teachers'),
      message: d.message || '',
      sent_by: ref(ctx.staffIds, d.sentBy),
      sent_at: toDate(d.sentAt) || new Date(),
    }),
  },

  {
    collection: 'staffMessages', table: 'staff_messages',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'sentAt',
    row: (d, id, ctx) => {
      if (!ctx.staffIds.has(d.teacherId)) return null;   // recipient is NOT NULL
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        recipient_staff_id: d.teacherId,
        channel: d.channel || 'email',
        message: d.message || '',
        sent_by: ref(ctx.staffIds, d.sentBy),
        sent_at: toDate(d.sentAt) || new Date(),
        status: d.status || 'sent',
        is_substitution_notice: !!d.isSubstitutionNotice,
      };
    },
  },

  {
    // channels[] is an embedded array -> parent_message_channels.
    collection: 'messages', table: 'parent_messages',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'sentAt',
    row: (d, id, ctx) => {
      if (!ctx.studentIds.has(d.studentId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        student_id: d.studentId,
        class_id: ref(ctx.classIds, d.classId),
        template: d.template || null,
        body: d.body || '',
        status: d.status || 'sent',
        // These docs store the sender's NAME, not their id (unlike every
        // other collection). Resolve where the name is unambiguous; keep
        // the raw string either way.
        sent_by_staff_id: ctx.staffIdByName.get(d.sentBy) || null,
        sent_by_name: d.sentBy || null,
        sent_by_role: d.sentByRole || null,
        sent_by_title: d.sentByTitle || null,
        sent_at: toDate(d.sentAt) || new Date(),
        date: d.date || new Date().toISOString().slice(0, 10),
      };
    },
    children: [{
      table: 'parent_message_channels',
      parentKey: 'parent_message_id',
      replaceOnParent: true,
      rows: d => [...new Set(d.channels || [])]
        .filter(c => ['portal', 'email', 'message'].includes(c))
        .map(channel => ({ channel })),
    }],
  },

  {
    collection: 'careAlerts', table: 'care_alerts',
    conflict: ['school_id', 'source_doc_id'], mode: 'incremental', since: 'createdAt',
    row: (d, id, ctx) => {
      if (!ctx.studentIds.has(d.studentId)) return null;
      return {
        source_doc_id: id, school_id: ctx.schoolId,
        student_id: d.studentId,
        class_id: ref(ctx.classIds, d.classId),
        rule_code: d.ruleCode || 'unknown',
        priority: oneOf(d.priority, ['low', 'medium', 'high'], 'medium'),
        status: oneOf(d.status, ['open', 'resolved'], 'open'),
        created_at: toDate(d.createdAt) || new Date(),
        resolved_at: toDate(d.resolvedAt),
        resolved_by: ref(ctx.staffIds, d.resolvedBy),
      };
    },
  },

  {
    // Raw hardware feed at the root. The timestamp field's type isn't
    // guaranteed (the readers have written both strings and Timestamps),
    // so this takes the newest N rather than range-querying.
    collection: 'tags', table: 'rfid_tag_scans', conflict: ['source_doc_id'],
    mode: 'recent', orderBy: 'timestamp', limit: 5000, root: true, oncePerRun: true,
    row: (d, id) => {
      if (!d.epc) return null;
      return {
        source_doc_id: id,
        epc: d.epc,
        antenna: d.antenna != null ? String(d.antenna) : null,
        scanned_at: toDate(d.timestamp) || new Date(),
      };
    },
  },
];

// The attendanceDays records subcollection, handled separately because it
// hangs off each day document rather than off the school.
const attendanceRecords = {
  table: 'attendance_records',
  conflict: ['attendance_day_id', 'student_id'],   // natural key; no doc id needed
  row: (d, dayId, ctx) => {
    if (!ctx.studentIds.has(d.studentId)) return null;
    return {
      attendance_day_id: dayId,
      student_id: d.studentId,
      status: oneOf(d.status, ['present', 'late', 'absent'], 'absent'),
      arrival_time: d.arrivalTime && d.arrivalTime !== '—' ? d.arrivalTime : null,
      marked_manually: !!d.markedManually,
    };
  },
};

module.exports = { collections, attendanceRecords };
