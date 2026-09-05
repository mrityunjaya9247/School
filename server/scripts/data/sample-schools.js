// Sample data in FIRESTORE shape — the mirror of sample_data.sql.
//
// Differences from the SQL version, because Firestore models things
// differently:
//   * camelCase fields, not snake_case
//   * arrays live inside their parent document (classIds, comments,
//     channels) instead of in join tables
//   * timestamps are Firestore Timestamps, not ISO strings
//   * attendance records are a subcollection under each day document
//
// Every document has an EXPLICIT id (nothing relies on addDoc auto-ids), so
// re-running the seed overwrites rather than duplicating. That also gives
// the Postgres sync a stable source_doc_id to upsert against.
'use strict';

// Relative dates so the seeded data always looks recent.
const daysAgo = n => new Date(Date.now() - n * 86400000);
const hoursAgo = n => new Date(Date.now() - n * 3600000);
const minsAgo = n => new Date(Date.now() - n * 60000);
const ymd = d => d.toISOString().slice(0, 10);

const YEAR = '2026-2027';
const YESTERDAY = ymd(daysAgo(1));

// ---------------------------------------------------------------------
// DEMO-01 — Bangalore. Overlaps with the app's own seedSchool(), so this
// one is skipped unless you pass --include-demo.
// ---------------------------------------------------------------------
const DEMO = {
  code: 'DEMO-01',
  doc: { name: 'DEMO-01 School', slug: 'demo-01', timezone: 'Asia/Kolkata',
         academicYear: YEAR, plan: 'pro', isActive: true, createdAt: daysAgo(120) },
  campuses: {
    'campus-001': { name: 'Main Campus', address: '1 School Road', city: 'Bangalore', isActive: true },
  },
  devices: {
    'device-001': { name: 'Main Gate A Reader', gateLabel: 'Main Gate A', campusId: 'campus-001',
                    status: 'online', readQualityPercent: 99, firmwareVersion: 'v3.2.1', lastHeartbeatAt: minsAgo(2) },
    'device-002': { name: 'North Gate B Reader', gateLabel: 'North Gate B', campusId: 'campus-001',
                    status: 'online', readQualityPercent: 97, firmwareVersion: 'v3.2.1', lastHeartbeatAt: minsAgo(1) },
    'device-003': { name: 'South Gate Reader', gateLabel: 'South Gate', campusId: 'campus-001',
                    status: 'offline', readQualityPercent: 0, firmwareVersion: 'v3.1.0', lastHeartbeatAt: daysAgo(6) },
  },
  staff: {
    'staff-principal': { name: 'Dr. Priya Sharma', email: 'principal@demo-01', role: 'principal',
                         classIds: [], watchClassIds: ['class-g6a', 'class-g6b'], createdAt: daysAgo(120) },
    'staff-t-g6a': { name: 'Ms. Asha Rao', email: 'teacher.g6a@demo-01', role: 'teacher',
                     classIds: ['class-g6a', 'class-g6b'], watchClassIds: [], createdAt: daysAgo(118) },
    'staff-t-g6b': { name: 'Mr. Vikram Nair', email: 'teacher.g6b@demo-01', role: 'teacher',
                     classIds: ['class-g6b'], watchClassIds: [], createdAt: daysAgo(118) },
  },
  classes: {
    'class-g6a': { name: '6-A', grade: '6', section: 'A', campusId: 'campus-001',
                   academicYear: YEAR, studentCount: 3, classTeacherId: 'staff-t-g6a' },
    'class-g6b': { name: '6-B', grade: '6', section: 'B', campusId: 'campus-001',
                   academicYear: YEAR, studentCount: 2, classTeacherId: 'staff-t-g6b' },
  },
  students: {
    'stu-g6a-01': { firstName: 'Aarav', lastName: 'Sharma', classId: 'class-g6a', roll: '6A-01',
                    guardianName: 'Mr. Sharma', parentEmail: 'parent.sharma@demo-01', parentPhone: '+91 9700000001' },
    'stu-g6a-02': { firstName: 'Diya', lastName: 'Iyer', classId: 'class-g6a', roll: '6A-02',
                    guardianName: 'Mrs. Iyer', parentEmail: 'parent.iyer@demo-01', parentPhone: '+91 9700000002' },
    'stu-g6a-03': { firstName: 'Kabir', lastName: 'Reddy', classId: 'class-g6a', roll: '6A-03',
                    guardianName: 'Mr. Reddy', parentEmail: 'parent.reddy@demo-01', parentPhone: '+91 9700000003' },
    // Ananya shares a guardian email with Diya — the sibling case the parent
    // login has to handle (one email, two children).
    'stu-g6b-01': { firstName: 'Ananya', lastName: 'Iyer', classId: 'class-g6b', roll: '6B-01',
                    guardianName: 'Mrs. Iyer', parentEmail: 'parent.iyer@demo-01', parentPhone: '+91 9700000002' },
    'stu-g6b-02': { firstName: 'Rohit', lastName: 'Verma', classId: 'class-g6b', roll: '6B-02',
                    guardianName: 'Mr. Verma', parentEmail: 'parent.verma@demo-01', parentPhone: '+91 9700000004' },
  },
  timetable: {
    'class-g6a_Mon_1': { classId: 'class-g6a', className: '6-A', day: 'Mon', period: 1, start: '08:00', end: '08:40',
                         subject: 'Mathematics', teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao' },
    'class-g6a_Mon_2': { classId: 'class-g6a', className: '6-A', day: 'Mon', period: 2, start: '08:45', end: '09:25',
                         subject: 'English', teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao' },
    'class-g6a_Mon_4': { classId: 'class-g6a', className: '6-A', day: 'Mon', period: 4, start: '10:15', end: '10:55',
                         subject: 'Science', teacherId: 'staff-t-g6b', teacherName: 'Mr. Vikram Nair' },
    'class-g6b_Mon_1': { classId: 'class-g6b', className: '6-B', day: 'Mon', period: 1, start: '08:00', end: '08:40',
                         subject: 'Science', teacherId: 'staff-t-g6b', teacherName: 'Mr. Vikram Nair' },
    'class-g6b_Mon_4': { classId: 'class-g6b', className: '6-B', day: 'Mon', period: 4, start: '10:15', end: '10:55',
                         subject: 'Mathematics', teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao' },
  },
  staffLogins: {
    'seed-login-1': { staffId: 'staff-principal', staffName: 'Dr. Priya Sharma', role: 'principal',
                      loginAt: hoursAgo(3), logoutAt: hoursAgo(2) },
    'seed-login-2': { staffId: 'staff-t-g6a', staffName: 'Ms. Asha Rao', role: 'teacher',
                      loginAt: hoursAgo(2), logoutAt: null },
  },
  substitutions: {
    'seed-sub-1': { date: YESTERDAY, day: 'Mon', classId: 'class-g6a', className: '6-A', period: 1,
                    start: '08:00', end: '08:40', subject: 'Mathematics',
                    originalTeacherId: 'staff-t-g6a', originalTeacherName: 'Ms. Asha Rao',
                    substituteTeacherId: 'staff-t-g6b', substituteTeacherName: 'Mr. Vikram Nair',
                    status: 'active', createdBy: 'staff-principal', createdByName: 'Dr. Priya Sharma',
                    createdAt: daysAgo(1) },
  },
  attendanceDays: {
    [`${YESTERDAY}_class-g6a`]: {
      doc: { date: YESTERDAY, classId: 'class-g6a', campusId: 'campus-001', totalStudents: 3,
             presentCount: 2, lateCount: 1, absentCount: 0, isReconciled: true, isLocked: true },
      records: {
        'rec-1': { studentId: 'stu-g6a-01', firstName: 'Aarav', lastName: 'Sharma', classId: 'class-g6a',
                   status: 'present', arrivalTime: '07:52 AM', entryTime: '07:52 AM', markedManually: false },
        'rec-2': { studentId: 'stu-g6a-02', firstName: 'Diya', lastName: 'Iyer', classId: 'class-g6a',
                   status: 'present', arrivalTime: '07:58 AM', entryTime: '07:58 AM', markedManually: false },
        'rec-3': { studentId: 'stu-g6a-03', firstName: 'Kabir', lastName: 'Reddy', classId: 'class-g6a',
                   status: 'late', arrivalTime: '08:41 AM', entryTime: '08:41 AM', markedManually: false },
      },
    },
    [`${YESTERDAY}_class-g6b`]: {
      doc: { date: YESTERDAY, classId: 'class-g6b', campusId: 'campus-001', totalStudents: 2,
             presentCount: 1, lateCount: 0, absentCount: 1, isReconciled: true, isLocked: true },
      records: {
        'rec-1': { studentId: 'stu-g6b-01', firstName: 'Ananya', lastName: 'Iyer', classId: 'class-g6b',
                   status: 'present', arrivalTime: '07:49 AM', entryTime: '07:49 AM', markedManually: false },
        'rec-2': { studentId: 'stu-g6b-02', firstName: 'Rohit', lastName: 'Verma', classId: 'class-g6b',
                   status: 'absent', arrivalTime: '—', entryTime: '—', markedManually: true },
      },
    },
  },
  events: {
    'seed-evt-1': { direction: 'entry', gateLabel: 'Main Gate A', campusId: 'campus-001', confidence: 'high',
                    scannedAt: minsAgo(10), notificationStatus: 'sent', isCorrected: false,
                    studentId: 'stu-g6a-01', _studentName: 'Aarav Sharma' },
    'seed-evt-2': { direction: 'entry', gateLabel: 'Main Gate A', campusId: 'campus-001', confidence: 'high',
                    scannedAt: minsAgo(9), notificationStatus: 'sent', isCorrected: false,
                    studentId: 'stu-g6a-02', _studentName: 'Diya Iyer' },
    'seed-evt-3': { direction: 'entry', gateLabel: 'North Gate B', campusId: 'campus-001', confidence: 'low',
                    scannedAt: minsAgo(8), notificationStatus: 'sent', isCorrected: true,
                    studentId: 'stu-g6a-03', _studentName: 'Kabir Reddy' },
    // Unassigned tag — exercises the "⚠ Unassigned tag" path in the scan feed.
    'seed-evt-4': { direction: 'unknown', gateLabel: 'Main Gate A', campusId: 'campus-001', confidence: 'low',
                    scannedAt: minsAgo(6), notificationStatus: 'failed', isCorrected: false,
                    _studentName: 'Unknown Tag' },
  },
  classReviews: {
    // Full loop: principal raised it, teacher replied, principal acknowledged.
    'seed-rev-1': { classId: 'class-g6a', className: '6-A', teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao',
                    createdBy: 'staff-principal', createdByName: 'Dr. Priya Sharma',
                    healthPct: 71, healthStatus: 'watch', status: 'acknowledged',
                    createdAt: daysAgo(4), acknowledgedAt: daysAgo(2),
                    needsPrincipalAck: false, principalAckAt: daysAgo(1),
                    comments: [
                      { by: 'principal', name: 'Dr. Priya Sharma', text: 'Attendance slipped below 75% last week — can you look into it?', at: daysAgo(4) },
                      { by: 'teacher', name: 'Ms. Asha Rao', text: 'Three students were down with fever. I have called all guardians.', at: daysAgo(2) },
                    ] },
    // Teacher replied; still waiting on the principal — drives the amber
    // "Awaiting principal" badge.
    'seed-rev-2': { classId: 'class-g6b', className: '6-B', teacherId: 'staff-t-g6b', teacherName: 'Mr. Vikram Nair',
                    createdBy: 'staff-principal', createdByName: 'Dr. Priya Sharma',
                    healthPct: 63, healthStatus: 'poor', status: 'acknowledged',
                    createdAt: daysAgo(2), acknowledgedAt: hoursAgo(6),
                    needsPrincipalAck: true, principalAckAt: null,
                    comments: [
                      { by: 'principal', name: 'Dr. Priya Sharma', text: '6-B has the lowest attendance this month. Please share a plan.', at: daysAgo(2) },
                      { by: 'teacher', name: 'Mr. Vikram Nair', text: 'Meeting the parents of the four repeat absentees on Friday.', at: hoursAgo(6) },
                    ] },
  },
  subjectRequests: {
    'seed-req-1': { teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao', teacherEmail: 'teacher.g6a@demo-01',
                    classId: 'class-g6b', className: '6-B', classTeacherId: 'staff-t-g6b',
                    classTeacherName: 'Mr. Vikram Nair', subject: 'Mathematics',
                    status: 'approved', createdAt: daysAgo(10), decidedAt: daysAgo(9) },
  },
  announcements: {
    'seed-ann-1': { text: 'Annual sports day is on 20 September. Practice starts Monday.',
                    createdBy: 'staff-principal', createdByName: 'Dr. Priya Sharma', createdAt: daysAgo(2), active: true },
    'seed-ann-2': { text: 'Staff meeting moved to Thursday 4 PM.',
                    createdBy: 'staff-principal', createdByName: 'Dr. Priya Sharma', createdAt: daysAgo(12), active: false },
  },
  emergencyBroadcasts: {
    'seed-emg-1': { scope: 'all', message: 'Heavy rain — school closing at 12:30 PM today. Please arrange pickup.',
                    sentBy: 'staff-principal', sentByName: 'Dr. Priya Sharma', sentAt: daysAgo(20) },
  },
  staffMessages: {
    'seed-smsg-1': { teacherId: 'staff-t-g6b', teacherName: 'Mr. Vikram Nair', channel: 'email',
                     message: `You're covering Mathematics for 6-A, Period 1 (08:00–08:40) — Ms. Asha Rao is absent.`,
                     sentBy: 'staff-principal', sentByName: 'Dr. Priya Sharma', sentAt: daysAgo(1),
                     status: 'sent', isSubstitutionNotice: true },
    'seed-smsg-2': { teacherId: 'staff-t-g6a', teacherName: 'Ms. Asha Rao', channel: 'email',
                     message: 'Please submit the 6-A monthly attendance summary before Friday.',
                     sentBy: 'staff-principal', sentByName: 'Dr. Priya Sharma', sentAt: hoursAgo(5),
                     status: 'sent', isSubstitutionNotice: false },
  },
  messages: {
    // NOTE: sentBy holds the sender's NAME here, matching what the app writes.
    'seed-msg-1': { studentId: 'stu-g6b-02', studentName: 'Rohit Verma', classId: 'class-g6b',
                    channels: ['portal', 'email', 'message'], template: 'absence',
                    body: 'Rohit was marked absent today. Please let us know if he is unwell.',
                    status: 'sent', sentBy: 'Mr. Vikram Nair', sentByRole: 'teacher',
                    sentByTitle: 'Class Teacher', sentAt: daysAgo(1), date: YESTERDAY },
    'seed-msg-2': { studentId: 'stu-g6a-03', studentName: 'Kabir Reddy', classId: 'class-g6a',
                    channels: ['portal', 'email'], template: 'late_arrival',
                    body: 'Kabir arrived at 08:41 AM today. Repeated late arrivals affect the first period.',
                    status: 'sent', sentBy: 'Ms. Asha Rao', sentByRole: 'teacher',
                    sentByTitle: 'Class Teacher', sentAt: daysAgo(1), date: YESTERDAY },
  },
  careAlerts: {
    'seed-care-1': { studentId: 'stu-g6b-02', studentName: 'Rohit Verma', classId: 'class-g6b',
                     ruleCode: '3_consecutive_absences', priority: 'high', status: 'open', createdAt: daysAgo(1) },
    'seed-care-2': { studentId: 'stu-g6a-03', studentName: 'Kabir Reddy', classId: 'class-g6a',
                     ruleCode: 'late_pattern_monthly', priority: 'medium', status: 'open', createdAt: daysAgo(2) },
  },
  tagMappings: {
    'stu-g6a-01': { epc: 'E20000195012004518300001', studentName: 'Aarav Sharma', classId: 'class-g6a', assignedAt: daysAgo(30) },
    'stu-g6a-02': { epc: 'E20000195012004518300002', studentName: 'Diya Iyer', classId: 'class-g6a', assignedAt: daysAgo(30) },
    'stu-g6a-03': { epc: 'E20000195012004518300003', studentName: 'Kabir Reddy', classId: 'class-g6a', assignedAt: daysAgo(30) },
    'stu-g6b-01': { epc: 'E20000195012004518300004', studentName: 'Ananya Iyer', classId: 'class-g6b', assignedAt: daysAgo(28) },
  },
};

// ---------------------------------------------------------------------
// SMHS-042 — Kochi. Two campuses; shows slug diverging from the code.
// ---------------------------------------------------------------------
const SMHS = {
  code: 'SMHS-042',
  doc: { name: "St. Mary's High School", slug: 'st-marys-high', timezone: 'Asia/Kolkata',
         academicYear: YEAR, plan: 'pro', isActive: true, createdAt: daysAgo(60) },
  campuses: {
    'campus-sm-main': { name: 'Senior Wing', address: '22 Marine Drive', city: 'Kochi', isActive: true },
    'campus-sm-jr':   { name: 'Junior Wing', address: '24 Marine Drive', city: 'Kochi', isActive: true },
  },
  devices: {
    'device-sm-01': { name: 'Senior Gate Reader', gateLabel: 'Senior Gate', campusId: 'campus-sm-main',
                      status: 'online', readQualityPercent: 98, firmwareVersion: 'v3.2.1', lastHeartbeatAt: minsAgo(3) },
    'device-sm-02': { name: 'Junior Gate Reader', gateLabel: 'Junior Gate', campusId: 'campus-sm-jr',
                      status: 'online', readQualityPercent: 95, firmwareVersion: 'v3.2.0', lastHeartbeatAt: minsAgo(4) },
  },
  staff: {
    'staff-sm-prin': { name: 'Sr. Anitha Joseph', email: 'principal@smhs-042', role: 'principal',
                       classIds: [], watchClassIds: ['class-sm-g9a'], createdAt: daysAgo(60) },
    'staff-sm-t1': { name: 'Mr. Rohan Menon', email: 'rohan.menon@smhs-042', role: 'teacher',
                     classIds: ['class-sm-g9a'], watchClassIds: [], createdAt: daysAgo(58) },
    'staff-sm-t2': { name: 'Ms. Divya Pillai', email: 'divya.pillai@smhs-042', role: 'teacher',
                     classIds: ['class-sm-g5a', 'class-sm-g9a'], watchClassIds: [], createdAt: daysAgo(58) },
  },
  classes: {
    'class-sm-g9a': { name: '9-A', grade: '9', section: 'A', campusId: 'campus-sm-main',
                      academicYear: YEAR, studentCount: 2, classTeacherId: 'staff-sm-t1' },
    'class-sm-g5a': { name: '5-A', grade: '5', section: 'A', campusId: 'campus-sm-jr',
                      academicYear: YEAR, studentCount: 1, classTeacherId: 'staff-sm-t2' },
  },
  students: {
    'stu-sm-01': { firstName: 'Alan', lastName: 'Thomas', classId: 'class-sm-g9a', roll: '9A-01',
                   guardianName: 'Mr. Thomas', parentEmail: 'thomas.family@smhs-042', parentPhone: '+91 9800000001' },
    'stu-sm-02': { firstName: 'Meera', lastName: 'Nair', classId: 'class-sm-g9a', roll: '9A-02',
                   guardianName: 'Mrs. Nair', parentEmail: 'nair.home@smhs-042', parentPhone: '+91 9800000002' },
    'stu-sm-03': { firstName: 'Ishaan', lastName: 'Kurian', classId: 'class-sm-g5a', roll: '5A-01',
                   guardianName: 'Mr. Kurian', parentEmail: 'kurian.p@smhs-042', parentPhone: '+91 9800000003' },
  },
  timetable: {
    'class-sm-g9a_Mon_1': { classId: 'class-sm-g9a', className: '9-A', day: 'Mon', period: 1, start: '08:30', end: '09:15',
                            subject: 'Physics', teacherId: 'staff-sm-t1', teacherName: 'Mr. Rohan Menon' },
    'class-sm-g5a_Mon_1': { classId: 'class-sm-g5a', className: '5-A', day: 'Mon', period: 1, start: '08:30', end: '09:15',
                            subject: 'EVS', teacherId: 'staff-sm-t2', teacherName: 'Ms. Divya Pillai' },
  },
  staffLogins: {
    'seed-login-1': { staffId: 'staff-sm-t1', staffName: 'Mr. Rohan Menon', role: 'teacher',
                      loginAt: hoursAgo(5), logoutAt: hoursAgo(1) },
  },
  substitutions: {
    'seed-sub-1': { date: YESTERDAY, day: 'Mon', classId: 'class-sm-g9a', className: '9-A', period: 1,
                    start: '08:30', end: '09:15', subject: 'Physics',
                    originalTeacherId: 'staff-sm-t1', originalTeacherName: 'Mr. Rohan Menon',
                    substituteTeacherId: 'staff-sm-t2', substituteTeacherName: 'Ms. Divya Pillai',
                    status: 'cancelled', createdBy: 'staff-sm-prin', createdByName: 'Sr. Anitha Joseph',
                    createdAt: daysAgo(2) },
  },
  attendanceDays: {
    [`${YESTERDAY}_class-sm-g9a`]: {
      doc: { date: YESTERDAY, classId: 'class-sm-g9a', campusId: 'campus-sm-main', totalStudents: 2,
             presentCount: 2, lateCount: 0, absentCount: 0, isReconciled: true, isLocked: false },
      records: {
        'rec-1': { studentId: 'stu-sm-01', firstName: 'Alan', lastName: 'Thomas', classId: 'class-sm-g9a',
                   status: 'present', arrivalTime: '08:20 AM', entryTime: '08:20 AM', markedManually: false },
        'rec-2': { studentId: 'stu-sm-02', firstName: 'Meera', lastName: 'Nair', classId: 'class-sm-g9a',
                   status: 'present', arrivalTime: '08:24 AM', entryTime: '08:24 AM', markedManually: false },
      },
    },
  },
  events: {
    'seed-evt-1': { direction: 'entry', gateLabel: 'Senior Gate', campusId: 'campus-sm-main', confidence: 'high',
                    scannedAt: minsAgo(7), notificationStatus: 'sent', isCorrected: false,
                    studentId: 'stu-sm-01', _studentName: 'Alan Thomas' },
  },
  classReviews: {},
  subjectRequests: {
    'seed-req-1': { teacherId: 'staff-sm-t2', teacherName: 'Ms. Divya Pillai', teacherEmail: 'divya.pillai@smhs-042',
                    classId: 'class-sm-g9a', className: '9-A', classTeacherId: 'staff-sm-t1',
                    classTeacherName: 'Mr. Rohan Menon', subject: 'Chemistry',
                    status: 'pending', createdAt: daysAgo(2), decidedAt: null },
  },
  announcements: {
    'seed-ann-1': { text: 'Half-yearly exam timetable is now on the notice board.',
                    createdBy: 'staff-sm-prin', createdByName: 'Sr. Anitha Joseph', createdAt: daysAgo(1), active: true },
  },
  emergencyBroadcasts: {
    'seed-emg-1': { scope: 'teachers', message: 'Fire drill at 11 AM. Please escort classes to the assembly ground.',
                    sentBy: 'staff-sm-prin', sentByName: 'Sr. Anitha Joseph', sentAt: daysAgo(3) },
  },
  staffMessages: {
    'seed-smsg-1': { teacherId: 'staff-sm-t1', teacherName: 'Mr. Rohan Menon', channel: 'email',
                     message: 'Parent-teacher meeting slots for 9-A are open for booking.',
                     sentBy: 'staff-sm-prin', sentByName: 'Sr. Anitha Joseph', sentAt: daysAgo(2),
                     status: 'sent', isSubstitutionNotice: false },
  },
  messages: {},
  careAlerts: {},
  tagMappings: {
    'stu-sm-01': { epc: 'E20000195012004518300101', studentName: 'Alan Thomas', classId: 'class-sm-g9a', assignedAt: daysAgo(15) },
  },
};

// ---------------------------------------------------------------------
// GVN-108 — Pune. Smallest; everything left in an unresolved state so the
// "needs attention" paths have something to show.
// ---------------------------------------------------------------------
const GVN = {
  code: 'GVN-108',
  doc: { name: 'Greenvale National School', slug: 'greenvale', timezone: 'Asia/Kolkata',
         academicYear: YEAR, plan: 'basic', isActive: true, createdAt: daysAgo(20) },
  campuses: {
    'campus-gvn': { name: 'Greenvale Campus', address: '5 Baner Road', city: 'Pune', isActive: true },
  },
  devices: {
    'device-gvn-01': { name: 'Front Gate Reader', gateLabel: 'Front Gate', campusId: 'campus-gvn',
                       status: 'online', readQualityPercent: 92, firmwareVersion: 'v3.1.0', lastHeartbeatAt: minsAgo(9) },
  },
  staff: {
    'staff-gvn-prin': { name: 'Mr. Sanjay Deshmukh', email: 'principal@gvn-108', role: 'principal',
                        classIds: [], watchClassIds: [], createdAt: daysAgo(20) },
    'staff-gvn-t1': { name: 'Ms. Neha Kulkarni', email: 'neha.k@gvn-108', role: 'teacher',
                      classIds: ['class-gvn-g8a'], watchClassIds: [], createdAt: daysAgo(19) },
  },
  classes: {
    'class-gvn-g8a': { name: '8-A', grade: '8', section: 'A', campusId: 'campus-gvn',
                       academicYear: YEAR, studentCount: 2, classTeacherId: 'staff-gvn-t1' },
  },
  students: {
    'stu-gvn-01': { firstName: 'Saanvi', lastName: 'Patil', classId: 'class-gvn-g8a', roll: '8A-01',
                    guardianName: 'Mrs. Patil', parentEmail: 'patil.family@gvn-108', parentPhone: '+91 9900000001' },
    'stu-gvn-02': { firstName: 'Arjun', lastName: 'Joshi', classId: 'class-gvn-g8a', roll: '8A-02',
                    guardianName: 'Mr. Joshi', parentEmail: 'joshi.a@gvn-108', parentPhone: '+91 9900000002' },
  },
  timetable: {
    'class-gvn-g8a_Mon_1': { classId: 'class-gvn-g8a', className: '8-A', day: 'Mon', period: 1, start: '09:00', end: '09:45',
                             subject: 'Marathi', teacherId: 'staff-gvn-t1', teacherName: 'Ms. Neha Kulkarni' },
  },
  staffLogins: {
    'seed-login-1': { staffId: 'staff-gvn-prin', staffName: 'Mr. Sanjay Deshmukh', role: 'principal',
                      loginAt: daysAgo(1), logoutAt: hoursAgo(22) },
  },
  substitutions: {},
  attendanceDays: {
    [`${YESTERDAY}_class-gvn-g8a`]: {
      doc: { date: YESTERDAY, classId: 'class-gvn-g8a', campusId: 'campus-gvn', totalStudents: 2,
             presentCount: 0, lateCount: 1, absentCount: 1, isReconciled: false, isLocked: false },
      records: {
        'rec-1': { studentId: 'stu-gvn-01', firstName: 'Saanvi', lastName: 'Patil', classId: 'class-gvn-g8a',
                   status: 'late', arrivalTime: '09:12 AM', entryTime: '09:12 AM', markedManually: false },
        'rec-2': { studentId: 'stu-gvn-02', firstName: 'Arjun', lastName: 'Joshi', classId: 'class-gvn-g8a',
                   status: 'absent', arrivalTime: '—', entryTime: '—', markedManually: false },
      },
    },
  },
  events: {
    'seed-evt-1': { direction: 'entry', gateLabel: 'Front Gate', campusId: 'campus-gvn', confidence: 'high',
                    scannedAt: minsAgo(6), notificationStatus: 'pending', isCorrected: false,
                    studentId: 'stu-gvn-01', _studentName: 'Saanvi Patil' },
  },
  classReviews: {
    // Pending — teacher hasn't responded, so it shows as "Needs your response".
    'seed-rev-1': { classId: 'class-gvn-g8a', className: '8-A', teacherId: 'staff-gvn-t1',
                    teacherName: 'Ms. Neha Kulkarni', createdBy: 'staff-gvn-prin',
                    createdByName: 'Mr. Sanjay Deshmukh', healthPct: 58, healthStatus: 'poor',
                    status: 'pending', createdAt: hoursAgo(5), acknowledgedAt: null,
                    needsPrincipalAck: false, principalAckAt: null,
                    comments: [
                      { by: 'principal', name: 'Mr. Sanjay Deshmukh', text: 'Several late arrivals this week — please review.', at: hoursAgo(5) },
                    ] },
  },
  subjectRequests: {
    'seed-req-1': { teacherId: 'staff-gvn-t1', teacherName: 'Ms. Neha Kulkarni', teacherEmail: 'neha.k@gvn-108',
                    classId: 'class-gvn-g8a', className: '8-A', classTeacherId: 'staff-gvn-t1',
                    classTeacherName: 'Ms. Neha Kulkarni', subject: 'Hindi',
                    status: 'rejected', createdAt: daysAgo(6), decidedAt: daysAgo(5) },
  },
  announcements: {
    'seed-ann-1': { text: 'Ganesh Chaturthi holiday — school closed 15-16 September.',
                    createdBy: 'staff-gvn-prin', createdByName: 'Mr. Sanjay Deshmukh', createdAt: hoursAgo(4), active: true },
  },
  emergencyBroadcasts: {},
  staffMessages: {},
  messages: {
    'seed-msg-1': { studentId: 'stu-gvn-02', studentName: 'Arjun Joshi', classId: 'class-gvn-g8a',
                    channels: ['email', 'message'], template: 'absence',
                    body: 'Arjun was absent today. Kindly send a note on his return.',
                    status: 'sent', sentBy: 'Ms. Neha Kulkarni', sentByRole: 'teacher',
                    sentByTitle: 'Class Teacher', sentAt: hoursAgo(20), date: YESTERDAY },
  },
  careAlerts: {
    'seed-care-1': { studentId: 'stu-gvn-02', studentName: 'Arjun Joshi', classId: 'class-gvn-g8a',
                     ruleCode: '3_consecutive_absences', priority: 'high', status: 'open', createdAt: daysAgo(1) },
  },
  tagMappings: {
    'stu-gvn-01': { epc: 'E20000195012004518300201', studentName: 'Saanvi Patil', classId: 'class-gvn-g8a', assignedAt: daysAgo(7) },
  },
};

// Root-level raw scan feed — normally written by the reader hardware.
const TAG_SCANS = {
  'seed-scan-1': { epc: 'E20000195012004518300001', antenna: '1', timestamp: minsAgo(10) },
  'seed-scan-2': { epc: 'E20000195012004518300002', antenna: '1', timestamp: minsAgo(9) },
  'seed-scan-3': { epc: 'E20000195012004518300003', antenna: '2', timestamp: minsAgo(8) },
  'seed-scan-4': { epc: 'E20000195012004518300101', antenna: '1', timestamp: minsAgo(7) },
  'seed-scan-5': { epc: 'E2000019FFFFFFFFFFFF9999', antenna: '1', timestamp: minsAgo(6) },
};

module.exports = { schools: [DEMO, SMHS, GVN], tagScans: TAG_SCANS, DEMO_CODE: 'DEMO-01' };
