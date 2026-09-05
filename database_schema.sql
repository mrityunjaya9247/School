-- =====================================================================
-- AARNA School Management — Relational Database Schema (PostgreSQL)
-- =====================================================================
-- Reverse-engineered from the live Firestore data model in index.html
-- (the app currently reads/writes Firestore directly from the browser,
-- with collections nested under schools/{code}/...). This schema is a
-- normalized relational translation of that model, intended for the
-- "real backend" migration recommended in architecture_review.md.
--
-- Conventions:
--   * Every school-scoped table carries school_id (FK -> schools.id) so
--     multi-tenancy is enforced by the database, not just by client-side
--     path prefixes as it is today.
--   * schools.id uses the human-readable school code (e.g. "DEMO-01")
--     as its natural primary key, matching how the app already
--     addresses everything via sess.code.
--   * Firestore arrays/maps that were embedded on a parent document
--     (comments[], classIds[], channels[]) are normalized into their
--     own child/join tables below.
--   * "parent" is NOT a stored role: parents authenticate by matching
--     an email against students.parent_email (see app's login flow),
--     so there is intentionally no parents/guardians table — guardian
--     details live on the student row, exactly as the app stores them.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS school;
SET search_path TO school, public;

-- ---------------------------------------------------------------------
-- Tenancy & campus structure
-- ---------------------------------------------------------------------

CREATE TABLE schools (
    id              VARCHAR(32)   PRIMARY KEY,          -- school "code", e.g. DEMO-01
    name            VARCHAR(200)  NOT NULL,
    slug            VARCHAR(64)   NOT NULL UNIQUE,
    timezone        VARCHAR(64)   NOT NULL DEFAULT 'Asia/Kolkata',
    academic_year   VARCHAR(16)   NOT NULL,              -- e.g. '2025-2026'
    plan            VARCHAR(32)   NOT NULL DEFAULT 'pro',
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE campuses (
    id              VARCHAR(64)   PRIMARY KEY,
    school_id       VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name            VARCHAR(200)  NOT NULL,
    address         VARCHAR(300),
    city            VARCHAR(120),
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_campuses_school ON campuses(school_id);

CREATE TABLE devices (                                   -- RFID gate readers
    id                    VARCHAR(64)  PRIMARY KEY,
    school_id             VARCHAR(32)  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    campus_id             VARCHAR(64)  REFERENCES campuses(id) ON DELETE SET NULL,
    name                  VARCHAR(200) NOT NULL,
    gate_label            VARCHAR(120) NOT NULL,
    status                VARCHAR(16)  NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
    read_quality_percent  SMALLINT     CHECK (read_quality_percent BETWEEN 0 AND 100),
    firmware_version      VARCHAR(32),
    last_heartbeat_at     TIMESTAMPTZ
);
CREATE INDEX idx_devices_school ON devices(school_id);

-- ---------------------------------------------------------------------
-- People: staff, classes, students
-- ---------------------------------------------------------------------

CREATE TABLE staff (
    id          VARCHAR(64)   PRIMARY KEY,
    school_id   VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        VARCHAR(200)  NOT NULL,
    email       VARCHAR(200)  NOT NULL,
    role        VARCHAR(16)   NOT NULL CHECK (role IN ('teacher','principal')),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (school_id, email)
);
CREATE INDEX idx_staff_school ON staff(school_id);

CREATE TABLE classes (
    id                VARCHAR(64)   PRIMARY KEY,
    school_id         VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    campus_id         VARCHAR(64)   REFERENCES campuses(id) ON DELETE SET NULL,
    name              VARCHAR(32)   NOT NULL,             -- e.g. '6-A'
    grade             VARCHAR(8)    NOT NULL,
    section           VARCHAR(4)    NOT NULL,
    academic_year     VARCHAR(16)   NOT NULL,
    class_teacher_id  VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,  -- homeroom teacher
    UNIQUE (school_id, grade, section, academic_year)
);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_teacher ON classes(class_teacher_id);

-- classIds[] on a staff doc: every class a teacher can access (homeroom
-- and/or subject-teacher assignments). class_teacher_id above already
-- captures "who is the homeroom teacher"; this join table captures the
-- full access list, including subject-only classes.
CREATE TABLE teacher_classes (
    staff_id    VARCHAR(64)  NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
    class_id    VARCHAR(64)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    is_home_room BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (staff_id, class_id)
);

-- watchClassIds[] on a staff doc: classes a staff member follows for
-- notifications without necessarily teaching them.
CREATE TABLE staff_watch_classes (
    staff_id    VARCHAR(64)  NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
    class_id    VARCHAR(64)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, class_id)
);

CREATE TABLE students (
    id             VARCHAR(64)   PRIMARY KEY,
    school_id      VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    class_id       VARCHAR(64)   REFERENCES classes(id) ON DELETE SET NULL,
    campus_id      VARCHAR(64)   REFERENCES campuses(id) ON DELETE SET NULL,
    first_name     VARCHAR(100)  NOT NULL,
    last_name      VARCHAR(100)  NOT NULL,
    roll           VARCHAR(32)   NOT NULL,
    guardian_name  VARCHAR(200),
    parent_email   VARCHAR(200),                          -- login key for the "parent" role
    parent_phone   VARCHAR(32),
    photo_url      VARCHAR(500),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (school_id, roll)
);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_parent_email ON students(parent_email);  -- parent login lookup

-- Staff login/logout audit trail (schools/{code}/staffLogins)
CREATE TABLE staff_logins (
    id          BIGSERIAL     PRIMARY KEY,
    school_id   VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id    VARCHAR(64)   NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
    role        VARCHAR(16)   NOT NULL,
    login_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    logout_at   TIMESTAMPTZ
);
CREATE INDEX idx_staff_logins_school ON staff_logins(school_id, login_at DESC);

-- ---------------------------------------------------------------------
-- Timetable & substitutions
-- ---------------------------------------------------------------------

CREATE TABLE timetable_slots (
    id          VARCHAR(80)   PRIMARY KEY,                -- '{classId}_{day}_{period}'
    school_id   VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    class_id    VARCHAR(64)   NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    day         VARCHAR(10)   NOT NULL,                    -- 'Mon'..'Fri'
    period      SMALLINT      NOT NULL,
    start_time  VARCHAR(8)    NOT NULL,
    end_time    VARCHAR(8)    NOT NULL,
    subject     VARCHAR(80)   NOT NULL,
    teacher_id  VARCHAR(64)   NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    UNIQUE (class_id, day, period)
);
CREATE INDEX idx_timetable_school ON timetable_slots(school_id);
CREATE INDEX idx_timetable_teacher ON timetable_slots(teacher_id);

CREATE TABLE substitutions (
    id                       BIGSERIAL     PRIMARY KEY,
    school_id                VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    class_id                 VARCHAR(64)   NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    date                     DATE          NOT NULL,
    day                      VARCHAR(10)   NOT NULL,
    period                   SMALLINT      NOT NULL,
    start_time               VARCHAR(8)    NOT NULL,
    end_time                 VARCHAR(8)    NOT NULL,
    subject                  VARCHAR(80)   NOT NULL,
    original_teacher_id      VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    substitute_teacher_id    VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    status                   VARCHAR(16)   NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
    created_by               VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_substitutions_school_date ON substitutions(school_id, date);

-- ---------------------------------------------------------------------
-- Attendance (RFID-driven)
-- ---------------------------------------------------------------------

-- One row per class per calendar day (schools/{code}/attendanceDays/{day_classId})
CREATE TABLE attendance_days (
    id               VARCHAR(96)  PRIMARY KEY,             -- '{date}_{classId}'
    school_id        VARCHAR(32)  NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    class_id         VARCHAR(64)  NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    campus_id        VARCHAR(64)  REFERENCES campuses(id) ON DELETE SET NULL,
    date             DATE         NOT NULL,
    total_students   SMALLINT     NOT NULL DEFAULT 0,
    present_count    SMALLINT     NOT NULL DEFAULT 0,
    absent_count     SMALLINT     NOT NULL DEFAULT 0,
    late_count       SMALLINT     NOT NULL DEFAULT 0,
    is_reconciled    BOOLEAN      NOT NULL DEFAULT FALSE,
    is_locked        BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (class_id, date)
);
CREATE INDEX idx_attendance_days_school_date ON attendance_days(school_id, date);

CREATE TABLE attendance_records (
    id                 BIGSERIAL     PRIMARY KEY,
    attendance_day_id  VARCHAR(96)   NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
    student_id         VARCHAR(64)   NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status             VARCHAR(10)   NOT NULL CHECK (status IN ('present','late','absent')),
    arrival_time       VARCHAR(16),                        -- display string, e.g. '07:12 AM'
    marked_manually    BOOLEAN       NOT NULL DEFAULT FALSE,
    UNIQUE (attendance_day_id, student_id)
);
CREATE INDEX idx_attendance_records_student ON attendance_records(student_id);

-- Gate entry/exit events derived from RFID scans (schools/{code}/events)
CREATE TABLE attendance_events (
    id                    BIGSERIAL    PRIMARY KEY,
    school_id             VARCHAR(32)  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    device_id             VARCHAR(64)  REFERENCES devices(id) ON DELETE SET NULL,
    campus_id             VARCHAR(64)  REFERENCES campuses(id) ON DELETE SET NULL,
    student_id            VARCHAR(64)  REFERENCES students(id) ON DELETE SET NULL,  -- null while tag is unassigned
    student_name_snapshot VARCHAR(200),                     -- denormalized label for unmatched/unknown tags
    direction             VARCHAR(10)  NOT NULL CHECK (direction IN ('entry','exit','unknown')),
    confidence            VARCHAR(10)  NOT NULL CHECK (confidence IN ('high','low')),
    scanned_at            TIMESTAMPTZ  NOT NULL,
    notification_status   VARCHAR(16)  NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sent','failed')),
    is_corrected          BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_attendance_events_school_time ON attendance_events(school_id, scanned_at DESC);
CREATE INDEX idx_attendance_events_student ON attendance_events(student_id);

-- RFID tag ↔ student mapping. Firestore stores this as a single
-- top-level collection (not school-scoped in the path), keyed by
-- student id, so school_id is carried as a plain column here.
CREATE TABLE rfid_tag_mappings (
    student_id   VARCHAR(64)   PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    school_id    VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id     VARCHAR(64)   REFERENCES classes(id) ON DELETE SET NULL,
    epc          VARCHAR(64)   NOT NULL UNIQUE,             -- RFID tag's electronic product code
    assigned_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Raw scan feed written directly by reader hardware (Firestore 'tags'
-- collection). Kept separate from attendance_events, which is the
-- reconciled/derived stream the app actually acts on.
CREATE TABLE rfid_tag_scans (
    id           BIGSERIAL    PRIMARY KEY,
    epc          VARCHAR(64)  NOT NULL,
    antenna      VARCHAR(16),
    scanned_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfid_tag_scans_epc ON rfid_tag_scans(epc);
CREATE INDEX idx_rfid_tag_scans_time ON rfid_tag_scans(scanned_at DESC);

-- ---------------------------------------------------------------------
-- Class health reviews (principal ↔ teacher feedback loop)
-- ---------------------------------------------------------------------

CREATE TABLE class_reviews (
    id                   BIGSERIAL     PRIMARY KEY,
    school_id            VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    class_id             VARCHAR(64)   NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    teacher_id           VARCHAR(64)   NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
    created_by           VARCHAR(64)   NOT NULL REFERENCES staff(id)    ON DELETE SET NULL,  -- the principal who opened it
    health_pct           SMALLINT      CHECK (health_pct BETWEEN 0 AND 100),
    health_status        VARCHAR(16),                        -- e.g. 'good' / 'watch' / 'poor'
    status               VARCHAR(16)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged')),
    needs_principal_ack  BOOLEAN       NOT NULL DEFAULT FALSE,
    principal_ack_at     TIMESTAMPTZ,
    acknowledged_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_class_reviews_school ON class_reviews(school_id);
CREATE INDEX idx_class_reviews_class ON class_reviews(class_id);

-- comments[] embedded array -> child table, one row per thread reply
CREATE TABLE class_review_comments (
    id               BIGSERIAL    PRIMARY KEY,
    class_review_id  BIGINT       NOT NULL REFERENCES class_reviews(id) ON DELETE CASCADE,
    author_role      VARCHAR(16)  NOT NULL CHECK (author_role IN ('teacher','principal')),
    author_name      VARCHAR(200) NOT NULL,
    text             TEXT         NOT NULL,
    commented_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_class_review_comments_review ON class_review_comments(class_review_id, commented_at);

-- ---------------------------------------------------------------------
-- Subject-teacher access requests
-- ---------------------------------------------------------------------

CREATE TABLE subject_requests (
    id                  BIGSERIAL     PRIMARY KEY,
    school_id           VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    teacher_id          VARCHAR(64)   NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
    class_id            VARCHAR(64)   NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    class_teacher_id    VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,  -- homeroom teacher at request time
    subject             VARCHAR(80)   NOT NULL,
    status              VARCHAR(16)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    decided_at          TIMESTAMPTZ,
    decided_by          VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL
);
CREATE INDEX idx_subject_requests_school ON subject_requests(school_id, status);

-- ---------------------------------------------------------------------
-- Communications: announcements, emergency broadcasts, staff & parent messages
-- ---------------------------------------------------------------------

CREATE TABLE announcements (
    id           BIGSERIAL     PRIMARY KEY,
    school_id    VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    text         TEXT          NOT NULL,
    created_by   VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_school_active ON announcements(school_id, active);

CREATE TABLE emergency_broadcasts (
    id           BIGSERIAL     PRIMARY KEY,
    school_id    VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    scope        VARCHAR(16)   NOT NULL CHECK (scope IN ('teachers','all')),
    message      TEXT          NOT NULL,
    sent_by      VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    sent_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_emergency_broadcasts_school_time ON emergency_broadcasts(school_id, sent_at DESC);

-- Staff-to-staff notices (e.g. substitution notices), schools/{code}/staffMessages
CREATE TABLE staff_messages (
    id                     BIGSERIAL     PRIMARY KEY,
    school_id              VARCHAR(32)   NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    recipient_staff_id     VARCHAR(64)   NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    channel                VARCHAR(16)   NOT NULL,           -- e.g. 'email'
    message                TEXT          NOT NULL,
    sent_by                VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL,
    sent_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
    status                 VARCHAR(16)   NOT NULL DEFAULT 'sent',
    is_substitution_notice BOOLEAN       NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_staff_messages_school_recipient ON staff_messages(school_id, recipient_staff_id);

-- Staff-to-parent messages about a student, schools/{code}/messages
CREATE TABLE parent_messages (
    id              BIGSERIAL     PRIMARY KEY,
    school_id       VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    student_id      VARCHAR(64)   NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        VARCHAR(64)   REFERENCES classes(id) ON DELETE SET NULL,
    template        VARCHAR(80),
    body            TEXT          NOT NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT 'sent',
    sent_by_staff_id VARCHAR(64)  REFERENCES staff(id) ON DELETE SET NULL,
    sent_by_role    VARCHAR(16),                             -- role at send time (teacher/principal)
    sent_by_title   VARCHAR(32),                             -- e.g. 'Class Teacher' / 'Subject Teacher' / 'Principal'
    sent_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    date            DATE          NOT NULL
);
CREATE INDEX idx_parent_messages_school_student ON parent_messages(school_id, student_id);

-- channels[] embedded array -> child table (a message can go out via
-- Parent Portal + Email + SMS simultaneously)
CREATE TABLE parent_message_channels (
    parent_message_id  BIGINT       NOT NULL REFERENCES parent_messages(id) ON DELETE CASCADE,
    channel             VARCHAR(16)  NOT NULL CHECK (channel IN ('portal','email','message')),
    PRIMARY KEY (parent_message_id, channel)
);

-- ---------------------------------------------------------------------
-- Care alerts (attendance-pattern based flags for at-risk students)
-- ---------------------------------------------------------------------

CREATE TABLE care_alerts (
    id           BIGSERIAL     PRIMARY KEY,
    school_id    VARCHAR(32)   NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
    student_id   VARCHAR(64)   NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id     VARCHAR(64)   REFERENCES classes(id) ON DELETE SET NULL,
    rule_code    VARCHAR(64)   NOT NULL,                      -- e.g. '3_consecutive_absences'
    priority     VARCHAR(10)   NOT NULL CHECK (priority IN ('low','medium','high')),
    status       VARCHAR(10)   NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    resolved_by  VARCHAR(64)   REFERENCES staff(id) ON DELETE SET NULL
);
CREATE INDEX idx_care_alerts_school_status ON care_alerts(school_id, status);
CREATE INDEX idx_care_alerts_student ON care_alerts(student_id);

-- =====================================================================
-- Notes / deliberate omissions
-- =====================================================================
-- 1. No `parents` table: the app derives parent access by matching
--    students.parent_email against the login email (see index.html's
--    parent-login flow at ~line 1611). If multi-child dashboards or
--    parent-owned preferences are ever needed, promote guardian_name/
--    parent_email/parent_phone into a `guardians` table with a
--    `student_guardians` join table — but that is a forward-looking
--    change, not something the current code models.
-- 2. classes.student_count in the source app is a denormalized cache
--    updated at seed time; here it can be dropped in favor of
--    `SELECT count(*) FROM students WHERE class_id = ...` or kept as a
--    trigger-maintained column — left out of DDL as a design choice to
--    make, not a data-loss risk.
-- 3. rfid_tag_scans/rfid_tag_mappings are modeled as school-independent
--    hardware feeds (matching Firestore's non-school-scoped paths);
--    rfid_tag_mappings still carries school_id since every mapping the
--    app writes includes schoolCode.
-- =====================================================================
