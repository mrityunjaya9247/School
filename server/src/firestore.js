// Firestore Admin SDK connection, used by the sync job.
//
// IMPORTANT: this is NOT the same credential as the `FB` config object in
// index.html. That one is a public client key, deliberately safe to ship
// in a web page. Server-side reads need a *service account* — a private
// key that bypasses Security Rules entirely.
//
// To get one:
//   Firebase console -> Project settings -> Service accounts
//   -> "Generate new private key" -> save the JSON
//
// Then point FIREBASE_SERVICE_ACCOUNT at that file (path), or paste the
// whole JSON into FIREBASE_SERVICE_ACCOUNT_JSON (useful on hosts like
// Koyeb where you only get env vars, not a filesystem).
//
// That key can read and write every school's data. Treat it like a root
// password: never commit it, never send it to the browser.
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

let db = null;

function loadCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson && inlineJson.trim()) {
    try {
      return JSON.parse(inlineJson);
    } catch (err) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON: ${err.message}`);
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!filePath) {
    throw new Error(
      'No Firebase credential configured. Set FIREBASE_SERVICE_ACCOUNT to the path of your ' +
      'service account JSON (Firebase console -> Project settings -> Service accounts), ' +
      'or FIREBASE_SERVICE_ACCOUNT_JSON to its contents.'
    );
  }

  const resolved = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT points at ${resolved}, which does not exist.`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

/** Lazily initialise and return the Firestore handle. */
function getFirestore() {
  if (db) return db;

  const serviceAccount = loadCredential();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/** Project id, for logging — never logs the key itself. */
function describe() {
  try {
    const sa = loadCredential();
    return { projectId: sa.project_id, clientEmail: sa.client_email };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Firestore Timestamp -> JS Date. Handles the several shapes a timestamp
 * can arrive in: a real Timestamp, an already-parsed Date, an ISO string
 * (some of the app's older writes), or null.
 */
function toDate(value) {
  if (value == null) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000);
  }
  return null;
}

module.exports = { getFirestore, describe, toDate };
