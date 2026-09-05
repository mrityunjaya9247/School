-- =====================================================================
-- 002 — Support for the nightly Firestore -> Postgres sync
-- =====================================================================
-- Run this AFTER database_schema.sql.
--
-- Two things the sync job needs that the base schema doesn't have:
--
--   1. source_doc_id — the Firestore document ID a row came from. Tables
--      with BIGSERIAL primary keys have no natural key to match on, so
--      without this the sync can't tell "this is the same document I
--      imported yesterday" from "this is a new document", and every run
--      would duplicate rows. With a UNIQUE constraint on it, the sync
--      becomes a plain idempotent upsert.
--
--   2. sync_runs — a log of every run: when, how triggered, how much
--      moved, what broke. A nightly job you can't inspect afterwards is
--      a nightly job you don't trust.
-- =====================================================================

SET search_path TO school, public;

-- ---------------------------------------------------------------------
-- 1. Firestore document IDs
-- ---------------------------------------------------------------------
ALTER TABLE staff_logins          ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE substitutions         ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE attendance_events     ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE class_reviews         ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE subject_requests      ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE announcements         ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE emergency_broadcasts  ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE staff_messages        ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE parent_messages       ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE care_alerts           ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);
ALTER TABLE rfid_tag_scans        ADD COLUMN IF NOT EXISTS source_doc_id VARCHAR(64);

-- Unique per school, so the sync can upsert on it. rfid_tag_scans comes
-- from a root-level collection with no school scoping, so its doc id is
-- unique on its own.
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_logins_src         ON staff_logins(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_substitutions_src        ON substitutions(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_events_src    ON attendance_events(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_reviews_src        ON class_reviews(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_requests_src     ON subject_requests(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_announcements_src        ON announcements(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_emergency_broadcasts_src ON emergency_broadcasts(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_messages_src       ON staff_messages(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_messages_src      ON parent_messages(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_alerts_src          ON care_alerts(school_id, source_doc_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rfid_tag_scans_src       ON rfid_tag_scans(source_doc_id);

-- ---------------------------------------------------------------------
-- 2. Preserve a value the base schema couldn't hold
-- ---------------------------------------------------------------------
-- Firestore's messages docs store `sentBy` as the sender's NAME
-- ("Ms. Asha Rao"), not their staff ID — unlike announcements and
-- staffMessages, which store the ID. The sync resolves that name back to
-- a staff row where it can, but names are not unique and staff get
-- renamed, so the raw string is kept here rather than silently lost.
ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(200);

-- ---------------------------------------------------------------------
-- 3. Run log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id             BIGSERIAL    PRIMARY KEY,
    started_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ,
    status         VARCHAR(16)  NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running','success','partial','failed')),
    triggered_by   VARCHAR(16)  NOT NULL DEFAULT 'manual'
                   CHECK (triggered_by IN ('endpoint','cli','schedule','manual')),
    -- Incremental collections only pull documents newer than this, so a
    -- nightly run doesn't re-read (and re-bill) all of history.
    watermark_from TIMESTAMPTZ,
    watermark_to   TIMESTAMPTZ,
    docs_read      INTEGER      NOT NULL DEFAULT 0,
    rows_written   INTEGER      NOT NULL DEFAULT 0,
    rows_skipped   INTEGER      NOT NULL DEFAULT 0,
    detail         JSONB,        -- per-collection counts and skip reasons
    error          TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status  ON sync_runs(status, started_at DESC);
