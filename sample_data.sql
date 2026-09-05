-- =====================================================================
-- AARNA School Management — Sample Seed Data
-- =====================================================================
-- Three complete schools, exercising all 25 tables in the `school` schema.
-- Run AFTER database_schema.sql.
--
--   DEMO-01   Bangalore   — the demo tenant, single campus, richest data
--   SMHS-042  Kochi       — two campuses, shows slug diverging from id
--   GVN-108   Pune        — smallest, shows "pending"/unresolved states
--
-- Explicit IDs are used on BIGSERIAL columns so the parent/child links
-- are readable at a glance; the sequences are re-synced at the bottom of
-- this file so your first real INSERT doesn't collide with these rows.
-- =====================================================================

SET search_path TO school, public;

BEGIN;

-- ---------------------------------------------------------------------
-- 1. SCHOOLS
-- ---------------------------------------------------------------------
INSERT INTO schools (id, name, slug, timezone, academic_year, plan, is_active) VALUES
  ('DEMO-01',  'DEMO-01 School',              'demo-01',       'Asia/Kolkata', '2026-2027', 'pro',   TRUE),
  ('SMHS-042', 'St. Mary''s High School',     'st-marys-high', 'Asia/Kolkata', '2026-2027', 'pro',   TRUE),
  ('GVN-108',  'Greenvale National School',   'greenvale',     'Asia/Kolkata', '2026-2027', 'basic', TRUE);

-- ---------------------------------------------------------------------
-- 2. CAMPUSES
-- ---------------------------------------------------------------------
INSERT INTO campuses (id, school_id, name, address, city, is_active) VALUES
  ('campus-001',    'DEMO-01',  'Main Campus',   '1 School Road',        'Bangalore', TRUE),
  ('campus-sm-main','SMHS-042', 'Senior Wing',   '22 Marine Drive',      'Kochi',     TRUE),
  ('campus-sm-jr',  'SMHS-042', 'Junior Wing',   '24 Marine Drive',      'Kochi',     TRUE),
  ('campus-gvn',    'GVN-108',  'Greenvale Campus','5 Baner Road',       'Pune',      TRUE);

-- ---------------------------------------------------------------------
-- 3. DEVICES (RFID gate readers)
-- ---------------------------------------------------------------------
INSERT INTO devices (id, school_id, campus_id, name, gate_label, status, read_quality_percent, firmware_version, last_heartbeat_at) VALUES
  ('device-001',    'DEMO-01',  'campus-001',     'Main Gate A Reader',  'Main Gate A',  'online',  99, 'v3.2.1', now() - interval '2 minutes'),
  ('device-002',    'DEMO-01',  'campus-001',     'North Gate B Reader', 'North Gate B', 'online',  97, 'v3.2.1', now() - interval '1 minute'),
  ('device-003',    'DEMO-01',  'campus-001',     'South Gate Reader',   'South Gate',   'offline',  0, 'v3.1.0', now() - interval '6 days'),
  ('device-sm-01',  'SMHS-042', 'campus-sm-main', 'Senior Gate Reader',  'Senior Gate',  'online',  98, 'v3.2.1', now() - interval '3 minutes'),
  ('device-sm-02',  'SMHS-042', 'campus-sm-jr',   'Junior Gate Reader',  'Junior Gate',  'online',  95, 'v3.2.0', now() - interval '4 minutes'),
  ('device-gvn-01', 'GVN-108',  'campus-gvn',     'Front Gate Reader',   'Front Gate',   'online',  92, 'v3.1.0', now() - interval '9 minutes');

-- ---------------------------------------------------------------------
-- 4. STAFF
-- ---------------------------------------------------------------------
INSERT INTO staff (id, school_id, name, email, role) VALUES
  -- DEMO-01
  ('staff-principal',  'DEMO-01',  'Dr. Priya Sharma',   'principal@demo-01',    'principal'),
  ('staff-t-g6a',      'DEMO-01',  'Ms. Asha Rao',       'teacher.g6a@demo-01',  'teacher'),
  ('staff-t-g6b',      'DEMO-01',  'Mr. Vikram Nair',    'teacher.g6b@demo-01',  'teacher'),
  -- SMHS-042
  ('staff-sm-prin',    'SMHS-042', 'Sr. Anitha Joseph',  'principal@smhs-042',   'principal'),
  ('staff-sm-t1',      'SMHS-042', 'Mr. Rohan Menon',    'rohan.menon@smhs-042', 'teacher'),
  ('staff-sm-t2',      'SMHS-042', 'Ms. Divya Pillai',   'divya.pillai@smhs-042','teacher'),
  -- GVN-108
  ('staff-gvn-prin',   'GVN-108',  'Mr. Sanjay Deshmukh','principal@gvn-108',    'principal'),
  ('staff-gvn-t1',     'GVN-108',  'Ms. Neha Kulkarni',  'neha.k@gvn-108',       'teacher');

-- ---------------------------------------------------------------------
-- 5. CLASSES
-- ---------------------------------------------------------------------
INSERT INTO classes (id, school_id, campus_id, name, grade, section, academic_year, class_teacher_id) VALUES
  ('class-g6a',     'DEMO-01',  'campus-001',     '6-A',  '6',  'A', '2026-2027', 'staff-t-g6a'),
  ('class-g6b',     'DEMO-01',  'campus-001',     '6-B',  '6',  'B', '2026-2027', 'staff-t-g6b'),
  ('class-sm-g9a',  'SMHS-042', 'campus-sm-main', '9-A',  '9',  'A', '2026-2027', 'staff-sm-t1'),
  ('class-sm-g5a',  'SMHS-042', 'campus-sm-jr',   '5-A',  '5',  'A', '2026-2027', 'staff-sm-t2'),
  ('class-gvn-g8a', 'GVN-108',  'campus-gvn',     '8-A',  '8',  'A', '2026-2027', 'staff-gvn-t1');

-- ---------------------------------------------------------------------
-- 6. TEACHER ↔ CLASS ACCESS  (Firestore staff.classIds[])
--    is_home_room=TRUE mirrors classes.class_teacher_id; FALSE rows are
--    subject-teacher assignments in someone else's class.
-- ---------------------------------------------------------------------
INSERT INTO teacher_classes (staff_id, class_id, is_home_room) VALUES
  ('staff-t-g6a',  'class-g6a',     TRUE),
  ('staff-t-g6a',  'class-g6b',     FALSE),   -- Asha also teaches a subject in 6-B
  ('staff-t-g6b',  'class-g6b',     TRUE),
  ('staff-sm-t1',  'class-sm-g9a',  TRUE),
  ('staff-sm-t2',  'class-sm-g5a',  TRUE),
  ('staff-sm-t2',  'class-sm-g9a',  FALSE),
  ('staff-gvn-t1', 'class-gvn-g8a', TRUE);

-- ---------------------------------------------------------------------
-- 7. WATCH LISTS  (Firestore staff.watchClassIds[])
-- ---------------------------------------------------------------------
INSERT INTO staff_watch_classes (staff_id, class_id) VALUES
  ('staff-principal', 'class-g6a'),
  ('staff-principal', 'class-g6b'),
  ('staff-sm-prin',   'class-sm-g9a');

-- ---------------------------------------------------------------------
-- 8. STUDENTS
--    parent_email is the login key for the "parent" role. Note the two
--    Iyer siblings share one guardian email — the app supports that.
-- ---------------------------------------------------------------------
INSERT INTO students (id, school_id, class_id, campus_id, first_name, last_name, roll, guardian_name, parent_email, parent_phone, is_active) VALUES
  -- DEMO-01 / 6-A
  ('stu-g6a-01', 'DEMO-01', 'class-g6a', 'campus-001', 'Aarav',  'Sharma', '6A-01', 'Mr. Sharma',  'parent.sharma@demo-01',  '+91 9700000001', TRUE),
  ('stu-g6a-02', 'DEMO-01', 'class-g6a', 'campus-001', 'Diya',   'Iyer',   '6A-02', 'Mrs. Iyer',   'parent.iyer@demo-01',    '+91 9700000002', TRUE),
  ('stu-g6a-03', 'DEMO-01', 'class-g6a', 'campus-001', 'Kabir',  'Reddy',  '6A-03', 'Mr. Reddy',   'parent.reddy@demo-01',   '+91 9700000003', TRUE),
  -- DEMO-01 / 6-B  (Ananya Iyer is Diya's sibling — same guardian email)
  ('stu-g6b-01', 'DEMO-01', 'class-g6b', 'campus-001', 'Ananya', 'Iyer',   '6B-01', 'Mrs. Iyer',   'parent.iyer@demo-01',    '+91 9700000002', TRUE),
  ('stu-g6b-02', 'DEMO-01', 'class-g6b', 'campus-001', 'Rohit',  'Verma',  '6B-02', 'Mr. Verma',   'parent.verma@demo-01',   '+91 9700000004', TRUE),
  -- SMHS-042
  ('stu-sm-01',  'SMHS-042','class-sm-g9a','campus-sm-main','Alan','Thomas','9A-01','Mr. Thomas',  'thomas.family@smhs-042', '+91 9800000001', TRUE),
  ('stu-sm-02',  'SMHS-042','class-sm-g9a','campus-sm-main','Meera','Nair', '9A-02','Mrs. Nair',   'nair.home@smhs-042',     '+91 9800000002', TRUE),
  ('stu-sm-03',  'SMHS-042','class-sm-g5a','campus-sm-jr',  'Ishaan','Kurian','5A-01','Mr. Kurian','kurian.p@smhs-042',      '+91 9800000003', TRUE),
  -- GVN-108
  ('stu-gvn-01', 'GVN-108', 'class-gvn-g8a','campus-gvn',   'Saanvi','Patil','8A-01','Mrs. Patil', 'patil.family@gvn-108',   '+91 9900000001', TRUE),
  ('stu-gvn-02', 'GVN-108', 'class-gvn-g8a','campus-gvn',   'Arjun', 'Joshi','8A-02','Mr. Joshi',  'joshi.a@gvn-108',        '+91 9900000002', TRUE);

-- ---------------------------------------------------------------------
-- 9. STAFF LOGIN AUDIT
-- ---------------------------------------------------------------------
INSERT INTO staff_logins (id, school_id, staff_id, role, login_at, logout_at) VALUES
  (1, 'DEMO-01',  'staff-principal', 'principal', now() - interval '3 hours', now() - interval '2 hours'),
  (2, 'DEMO-01',  'staff-t-g6a',     'teacher',   now() - interval '2 hours', NULL),          -- still signed in
  (3, 'SMHS-042', 'staff-sm-t1',     'teacher',   now() - interval '5 hours', now() - interval '1 hour'),
  (4, 'GVN-108',  'staff-gvn-prin',  'principal', now() - interval '1 day',   now() - interval '22 hours');

-- ---------------------------------------------------------------------
-- 10. TIMETABLE  (id follows the app's '{classId}_{day}_{period}' pattern)
-- ---------------------------------------------------------------------
INSERT INTO timetable_slots (id, school_id, class_id, day, period, start_time, end_time, subject, teacher_id) VALUES
  ('class-g6a_Mon_1', 'DEMO-01', 'class-g6a', 'Mon', 1, '08:00', '08:40', 'Mathematics', 'staff-t-g6a'),
  ('class-g6a_Mon_2', 'DEMO-01', 'class-g6a', 'Mon', 2, '08:45', '09:25', 'English',     'staff-t-g6a'),
  ('class-g6a_Mon_4', 'DEMO-01', 'class-g6a', 'Mon', 4, '10:15', '10:55', 'Science',     'staff-t-g6b'),  -- visiting teacher
  ('class-g6b_Mon_1', 'DEMO-01', 'class-g6b', 'Mon', 1, '08:00', '08:40', 'Science',     'staff-t-g6b'),
  ('class-g6b_Mon_4', 'DEMO-01', 'class-g6b', 'Mon', 4, '10:15', '10:55', 'Mathematics', 'staff-t-g6a'),
  ('class-sm-g9a_Mon_1','SMHS-042','class-sm-g9a','Mon',1,'08:30','09:15','Physics',     'staff-sm-t1'),
  ('class-sm-g5a_Mon_1','SMHS-042','class-sm-g5a','Mon',1,'08:30','09:15','EVS',         'staff-sm-t2'),
  ('class-gvn-g8a_Mon_1','GVN-108','class-gvn-g8a','Mon',1,'09:00','09:45','Marathi',    'staff-gvn-t1');

-- ---------------------------------------------------------------------
-- 11. SUBSTITUTIONS
-- ---------------------------------------------------------------------
INSERT INTO substitutions (id, school_id, class_id, date, day, period, start_time, end_time, subject,
                           original_teacher_id, substitute_teacher_id, status, created_by, created_at) VALUES
  (1, 'DEMO-01', 'class-g6a', DATE '2026-09-07', 'Mon', 1, '08:00', '08:40', 'Mathematics',
      'staff-t-g6a', 'staff-t-g6b', 'active',    'staff-principal', now() - interval '1 day'),
  (2, 'SMHS-042','class-sm-g9a', DATE '2026-09-07','Mon', 1, '08:30','09:15','Physics',
      'staff-sm-t1', 'staff-sm-t2', 'cancelled', 'staff-sm-prin',   now() - interval '2 days');

-- ---------------------------------------------------------------------
-- 12. ATTENDANCE DAYS  (id = '{date}_{classId}', one row per class per day)
-- ---------------------------------------------------------------------
INSERT INTO attendance_days (id, school_id, class_id, campus_id, date, total_students, present_count, late_count, absent_count, is_reconciled, is_locked) VALUES
  ('2026-09-04_class-g6a',     'DEMO-01',  'class-g6a',     'campus-001',     DATE '2026-09-04', 3, 2, 1, 0, TRUE,  TRUE),
  ('2026-09-04_class-g6b',     'DEMO-01',  'class-g6b',     'campus-001',     DATE '2026-09-04', 2, 1, 0, 1, TRUE,  TRUE),
  ('2026-09-04_class-sm-g9a',  'SMHS-042', 'class-sm-g9a',  'campus-sm-main', DATE '2026-09-04', 2, 2, 0, 0, TRUE,  FALSE),
  ('2026-09-04_class-sm-g5a',  'SMHS-042', 'class-sm-g5a',  'campus-sm-jr',   DATE '2026-09-04', 1, 1, 0, 0, FALSE, FALSE),
  ('2026-09-04_class-gvn-g8a', 'GVN-108',  'class-gvn-g8a', 'campus-gvn',     DATE '2026-09-04', 2, 0, 1, 1, FALSE, FALSE);

-- ---------------------------------------------------------------------
-- 13. ATTENDANCE RECORDS  (one row per student per day)
-- ---------------------------------------------------------------------
INSERT INTO attendance_records (id, attendance_day_id, student_id, status, arrival_time, marked_manually) VALUES
  (1,  '2026-09-04_class-g6a',     'stu-g6a-01', 'present', '07:52 AM', FALSE),
  (2,  '2026-09-04_class-g6a',     'stu-g6a-02', 'present', '07:58 AM', FALSE),
  (3,  '2026-09-04_class-g6a',     'stu-g6a-03', 'late',    '08:41 AM', FALSE),
  (4,  '2026-09-04_class-g6b',     'stu-g6b-01', 'present', '07:49 AM', FALSE),
  (5,  '2026-09-04_class-g6b',     'stu-g6b-02', 'absent',  NULL,       TRUE),   -- marked by hand
  (6,  '2026-09-04_class-sm-g9a',  'stu-sm-01',  'present', '08:20 AM', FALSE),
  (7,  '2026-09-04_class-sm-g9a',  'stu-sm-02',  'present', '08:24 AM', FALSE),
  (8,  '2026-09-04_class-sm-g5a',  'stu-sm-03',  'present', '08:15 AM', FALSE),
  (9,  '2026-09-04_class-gvn-g8a', 'stu-gvn-01', 'late',    '09:12 AM', FALSE),
  (10, '2026-09-04_class-gvn-g8a', 'stu-gvn-02', 'absent',  NULL,       FALSE);

-- ---------------------------------------------------------------------
-- 14. RFID TAG MAPPINGS  (student ↔ tag EPC; one tag per student)
-- ---------------------------------------------------------------------
INSERT INTO rfid_tag_mappings (student_id, school_id, class_id, epc, assigned_at) VALUES
  ('stu-g6a-01', 'DEMO-01',  'class-g6a',     'E20000195012004518300001', now() - interval '30 days'),
  ('stu-g6a-02', 'DEMO-01',  'class-g6a',     'E20000195012004518300002', now() - interval '30 days'),
  ('stu-g6a-03', 'DEMO-01',  'class-g6a',     'E20000195012004518300003', now() - interval '30 days'),
  ('stu-g6b-01', 'DEMO-01',  'class-g6b',     'E20000195012004518300004', now() - interval '28 days'),
  ('stu-sm-01',  'SMHS-042', 'class-sm-g9a',  'E20000195012004518300101', now() - interval '15 days'),
  ('stu-gvn-01', 'GVN-108',  'class-gvn-g8a', 'E20000195012004518300201', now() - interval '7 days');
  -- note: stu-g6b-02, stu-sm-02, stu-sm-03, stu-gvn-02 have no tag issued yet

-- ---------------------------------------------------------------------
-- 15. RAW TAG SCANS  (written by reader hardware, school-agnostic feed)
-- ---------------------------------------------------------------------
INSERT INTO rfid_tag_scans (id, epc, antenna, scanned_at) VALUES
  (1, 'E20000195012004518300001', '1', now() - interval '10 minutes'),
  (2, 'E20000195012004518300002', '1', now() - interval '9 minutes'),
  (3, 'E20000195012004518300003', '2', now() - interval '8 minutes'),
  (4, 'E20000195012004518300101', '1', now() - interval '7 minutes'),
  (5, 'E2000019FFFFFFFFFFFF9999', '1', now() - interval '6 minutes');  -- unassigned tag

-- ---------------------------------------------------------------------
-- 16. ATTENDANCE EVENTS  (reconciled gate entries/exits)
--     Last row shows an unknown tag: student_id NULL, direction 'unknown'.
-- ---------------------------------------------------------------------
INSERT INTO attendance_events (id, school_id, device_id, campus_id, student_id, student_name_snapshot,
                               direction, confidence, scanned_at, notification_status, is_corrected) VALUES
  (1, 'DEMO-01',  'device-001',   'campus-001',     'stu-g6a-01', 'Aarav Sharma', 'entry',   'high', now() - interval '10 minutes', 'sent',    FALSE),
  (2, 'DEMO-01',  'device-001',   'campus-001',     'stu-g6a-02', 'Diya Iyer',    'entry',   'high', now() - interval '9 minutes',  'sent',    FALSE),
  (3, 'DEMO-01',  'device-002',   'campus-001',     'stu-g6a-03', 'Kabir Reddy',  'entry',   'low',  now() - interval '8 minutes',  'sent',    TRUE),
  (4, 'SMHS-042', 'device-sm-01', 'campus-sm-main', 'stu-sm-01',  'Alan Thomas',  'entry',   'high', now() - interval '7 minutes',  'sent',    FALSE),
  (5, 'GVN-108',  'device-gvn-01','campus-gvn',     'stu-gvn-01', 'Saanvi Patil', 'entry',   'high', now() - interval '6 minutes',  'pending', FALSE),
  (6, 'DEMO-01',  'device-001',   'campus-001',      NULL,        'Unknown Tag',  'unknown', 'low',  now() - interval '6 minutes',  'failed',  FALSE);

-- ---------------------------------------------------------------------
-- 17. CLASS REVIEWS  (principal → class teacher feedback)
-- ---------------------------------------------------------------------
INSERT INTO class_reviews (id, school_id, class_id, teacher_id, created_by, health_pct, health_status,
                           status, needs_principal_ack, principal_ack_at, acknowledged_at, created_at) VALUES
  -- Acknowledged, teacher replied, principal already ack'd the reply
  (1, 'DEMO-01', 'class-g6a', 'staff-t-g6a', 'staff-principal', 71, 'watch',
      'acknowledged', FALSE, now() - interval '1 day', now() - interval '2 days', now() - interval '4 days'),
  -- Teacher replied, still waiting on the principal to acknowledge
  (2, 'DEMO-01', 'class-g6b', 'staff-t-g6b', 'staff-principal', 63, 'poor',
      'acknowledged', TRUE,  NULL, now() - interval '6 hours', now() - interval '2 days'),
  -- Brand new, teacher hasn't responded yet
  (3, 'GVN-108', 'class-gvn-g8a', 'staff-gvn-t1', 'staff-gvn-prin', 58, 'poor',
      'pending', FALSE, NULL, NULL, now() - interval '5 hours');

-- Comment threads (Firestore stored these as an embedded comments[] array)
INSERT INTO class_review_comments (id, class_review_id, author_role, author_name, text, commented_at) VALUES
  (1, 1, 'principal', 'Dr. Priya Sharma', 'Attendance slipped below 75% last week — can you look into it?', now() - interval '4 days'),
  (2, 1, 'teacher',   'Ms. Asha Rao',     'Three students were down with fever. I have called all guardians.', now() - interval '2 days'),
  (3, 2, 'principal', 'Dr. Priya Sharma', '6-B has the lowest attendance this month. Please share a plan.',   now() - interval '2 days'),
  (4, 2, 'teacher',   'Mr. Vikram Nair',  'Meeting the parents of the four repeat absentees on Friday.',      now() - interval '6 hours'),
  (5, 3, 'principal', 'Mr. Sanjay Deshmukh', 'Several late arrivals this week — please review.',              now() - interval '5 hours');

-- ---------------------------------------------------------------------
-- 18. SUBJECT-TEACHER ACCESS REQUESTS
-- ---------------------------------------------------------------------
INSERT INTO subject_requests (id, school_id, teacher_id, class_id, class_teacher_id, subject, status, created_at, decided_at, decided_by) VALUES
  (1, 'DEMO-01',  'staff-t-g6a',  'class-g6b',    'staff-t-g6b', 'Mathematics', 'approved', now() - interval '10 days', now() - interval '9 days', 'staff-t-g6b'),
  (2, 'SMHS-042', 'staff-sm-t2',  'class-sm-g9a', 'staff-sm-t1', 'Chemistry',   'pending',  now() - interval '2 days',  NULL, NULL),
  (3, 'GVN-108',  'staff-gvn-t1', 'class-gvn-g8a','staff-gvn-t1','Hindi',       'rejected', now() - interval '6 days',  now() - interval '5 days', 'staff-gvn-prin');

-- ---------------------------------------------------------------------
-- 19. ANNOUNCEMENTS
-- ---------------------------------------------------------------------
INSERT INTO announcements (id, school_id, text, created_by, active, created_at) VALUES
  (1, 'DEMO-01',  'Annual sports day is on 20 September. Practice starts Monday.', 'staff-principal', TRUE,  now() - interval '2 days'),
  (2, 'DEMO-01',  'Staff meeting moved to Thursday 4 PM.',                         'staff-principal', FALSE, now() - interval '12 days'),
  (3, 'SMHS-042', 'Half-yearly exam timetable is now on the notice board.',        'staff-sm-prin',   TRUE,  now() - interval '1 day'),
  (4, 'GVN-108',  'Ganesh Chaturthi holiday — school closed 15-16 September.',     'staff-gvn-prin',  TRUE,  now() - interval '4 hours');

-- ---------------------------------------------------------------------
-- 20. EMERGENCY BROADCASTS
-- ---------------------------------------------------------------------
INSERT INTO emergency_broadcasts (id, school_id, scope, message, sent_by, sent_at) VALUES
  (1, 'DEMO-01',  'all',      'Heavy rain — school closing at 12:30 PM today. Please arrange pickup.', 'staff-principal', now() - interval '20 days'),
  (2, 'SMHS-042', 'teachers', 'Fire drill at 11 AM. Please escort classes to the assembly ground.',    'staff-sm-prin',   now() - interval '3 days');

-- ---------------------------------------------------------------------
-- 21. STAFF MESSAGES  (staff → staff, incl. auto substitution notices)
-- ---------------------------------------------------------------------
INSERT INTO staff_messages (id, school_id, recipient_staff_id, channel, message, sent_by, sent_at, status, is_substitution_notice) VALUES
  (1, 'DEMO-01',  'staff-t-g6b', 'email', 'You''re covering Mathematics for 6-A, Period 1 (08:00–08:40) on 2026-09-07 — Ms. Asha Rao is absent.', 'staff-principal', now() - interval '1 day',  'sent', TRUE),
  (2, 'DEMO-01',  'staff-t-g6a', 'email', 'Mr. Vikram Nair will cover your Mathematics class for 6-A, Period 1 on 2026-09-07.',                     'staff-principal', now() - interval '1 day',  'sent', TRUE),
  (3, 'DEMO-01',  'staff-t-g6a', 'email', 'Please submit the 6-A monthly attendance summary before Friday.',                                        'staff-principal', now() - interval '5 hours','sent', FALSE),
  (4, 'SMHS-042', 'staff-sm-t1', 'email', 'Parent-teacher meeting slots for 9-A are open for booking.',                                             'staff-sm-prin',   now() - interval '2 days', 'sent', FALSE);

-- ---------------------------------------------------------------------
-- 22. PARENT MESSAGES  (staff → a specific student's guardian)
-- ---------------------------------------------------------------------
INSERT INTO parent_messages (id, school_id, student_id, class_id, template, body, status,
                             sent_by_staff_id, sent_by_role, sent_by_title, sent_at, date) VALUES
  (1, 'DEMO-01',  'stu-g6b-02', 'class-g6b', 'absence',
      'Rohit was marked absent today (04 September). Please let us know if he is unwell.',
      'sent', 'staff-t-g6b', 'teacher', 'Class Teacher', now() - interval '1 day', DATE '2026-09-04'),
  (2, 'DEMO-01',  'stu-g6a-03', 'class-g6a', 'late_arrival',
      'Kabir arrived at 08:41 AM today. Repeated late arrivals affect the first period.',
      'sent', 'staff-t-g6a', 'teacher', 'Class Teacher', now() - interval '1 day', DATE '2026-09-04'),
  (3, 'DEMO-01',  'stu-g6a-01', 'class-g6a', 'appreciation',
      'Aarav has had perfect attendance this month. Well done!',
      'sent', 'staff-principal', 'principal', 'Principal', now() - interval '3 hours', DATE '2026-09-05'),
  (4, 'GVN-108',  'stu-gvn-02', 'class-gvn-g8a', 'absence',
      'Arjun was absent today. Kindly send a note on his return.',
      'sent', 'staff-gvn-t1', 'teacher', 'Class Teacher', now() - interval '20 hours', DATE '2026-09-04');

-- One message can go out over several channels at once
INSERT INTO parent_message_channels (parent_message_id, channel) VALUES
  (1, 'portal'), (1, 'email'), (1, 'message'),   -- absence: all three
  (2, 'portal'), (2, 'email'),
  (3, 'portal'),
  (4, 'email'),  (4, 'message');

-- ---------------------------------------------------------------------
-- 23. CARE ALERTS  (rule-driven flags on at-risk students)
-- ---------------------------------------------------------------------
INSERT INTO care_alerts (id, school_id, student_id, class_id, rule_code, priority, status, created_at, resolved_at, resolved_by) VALUES
  (1, 'DEMO-01', 'stu-g6b-02', 'class-g6b',     '3_consecutive_absences', 'high',   'open',     now() - interval '1 day',  NULL, NULL),
  (2, 'DEMO-01', 'stu-g6a-03', 'class-g6a',     'late_pattern_monthly',   'medium', 'open',     now() - interval '2 days', NULL, NULL),
  (3, 'DEMO-01', 'stu-g6a-02', 'class-g6a',     'late_pattern_monthly',   'low',    'resolved', now() - interval '9 days', now() - interval '6 days', 'staff-t-g6a'),
  (4, 'GVN-108', 'stu-gvn-02', 'class-gvn-g8a', '3_consecutive_absences', 'high',   'open',     now() - interval '1 day',  NULL, NULL);

-- ---------------------------------------------------------------------
-- Re-sync sequences so the next real INSERT doesn't collide with the
-- explicit IDs used above.
-- ---------------------------------------------------------------------
SELECT setval('staff_logins_id_seq',          (SELECT max(id) FROM staff_logins));
SELECT setval('substitutions_id_seq',         (SELECT max(id) FROM substitutions));
SELECT setval('attendance_records_id_seq',    (SELECT max(id) FROM attendance_records));
SELECT setval('attendance_events_id_seq',     (SELECT max(id) FROM attendance_events));
SELECT setval('rfid_tag_scans_id_seq',        (SELECT max(id) FROM rfid_tag_scans));
SELECT setval('class_reviews_id_seq',         (SELECT max(id) FROM class_reviews));
SELECT setval('class_review_comments_id_seq', (SELECT max(id) FROM class_review_comments));
SELECT setval('subject_requests_id_seq',      (SELECT max(id) FROM subject_requests));
SELECT setval('announcements_id_seq',         (SELECT max(id) FROM announcements));
SELECT setval('emergency_broadcasts_id_seq',  (SELECT max(id) FROM emergency_broadcasts));
SELECT setval('staff_messages_id_seq',        (SELECT max(id) FROM staff_messages));
SELECT setval('parent_messages_id_seq',       (SELECT max(id) FROM parent_messages));
SELECT setval('care_alerts_id_seq',           (SELECT max(id) FROM care_alerts));

COMMIT;

-- =====================================================================
-- Handy checks after loading
-- =====================================================================
-- Row count per table:
--   SELECT relname, n_live_tup FROM pg_stat_user_tables
--   WHERE schemaname='school' ORDER BY relname;
--
-- Parent login lookup (how the app authenticates a guardian) — returns
-- both Iyer siblings for the one shared guardian email:
--   SELECT id, first_name, last_name, class_id FROM students
--   WHERE parent_email = 'parent.iyer@demo-01';
--
-- Attendance % per class for 04 Sep:
--   SELECT c.name, d.present_count, d.late_count, d.absent_count,
--          ROUND(100.0*(d.present_count+d.late_count)/d.total_students,1) AS pct
--   FROM attendance_days d JOIN classes c ON c.id=d.class_id
--   WHERE d.date = DATE '2026-09-04' ORDER BY c.name;
-- =====================================================================
