// PostgreSQL connection pool for the AARNA backend.
//
// Every query in the app goes through this module — nothing else should
// create its own client. The pool is created once at require() time and
// reused for the life of the process.
//
// Credentials come from .env (never committed). See .env.example.
'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// ---------------------------------------------------------------------
// SSL. Amazon RDS terminates TLS, so we connect over SSL by default.
//
//   DB_SSL=false          -> plain connection (use for local Postgres)
//   DB_SSL=true           -> SSL on, certificate not verified (fine to
//                            start with; the traffic is still encrypted)
//   DB_SSL_CA=/path/ca.pem-> SSL on AND the server certificate is verified
//                            against the RDS CA bundle. This is what you
//                            want in production — download the bundle from
//                            https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
// ---------------------------------------------------------------------
function buildSslConfig() {
  const sslEnabled = String(process.env.DB_SSL ?? 'true').toLowerCase() === 'true';
  if (!sslEnabled) return false;

  const caPath = process.env.DB_SSL_CA;
  if (caPath) {
    const resolved = path.isAbsolute(caPath) ? caPath : path.join(__dirname, '..', caPath);
    try {
      return { ca: fs.readFileSync(resolved, 'utf8'), rejectUnauthorized: true };
    } catch (err) {
      console.warn(`[db] DB_SSL_CA set but unreadable at ${resolved} (${err.message}) — falling back to unverified SSL.`);
    }
  }
  return { rejectUnauthorized: false };
}

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: buildSslConfig(),

  // Pool tuning. RDS db.t3.micro allows ~85 connections total, so keep this
  // modest — especially if you ever run more than one instance of the server.
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,     // fail fast if the security group is blocking us
};

const pool = new Pool(config);

// Every connection starts scoped to the `school` schema, so queries can say
// `FROM students` instead of `FROM school.students`.
const SEARCH_PATH = process.env.DB_SCHEMA || 'school';
pool.on('connect', client => {
  client.query(`SET search_path TO ${SEARCH_PATH}, public`).catch(err => {
    console.error('[db] failed to set search_path:', err.message);
  });
});

pool.on('error', err => {
  // A pooled client dropped while idle (network blip, RDS failover, instance
  // restarted after the 7-day stop window). pg replaces it automatically —
  // log it so it isn't silent, but don't crash the server.
  console.error('[db] idle client error:', err.message);
});

/**
 * Run a query. Always use $1/$2 placeholders — never string-concatenate
 * user input into SQL.
 *   const { rows } = await query('SELECT * FROM students WHERE school_id = $1', [code]);
 */
async function query(text, params) {
  const started = Date.now();
  const result = await pool.query(text, params);
  const ms = Date.now() - started;
  if (ms > 500) console.warn(`[db] slow query (${ms}ms): ${text.slice(0, 90)}`);
  return result;
}

/**
 * Run several statements as one transaction. Rolls back on any error.
 *   await withTransaction(async c => {
 *     await c.query('INSERT INTO attendance_days ...');
 *     await c.query('INSERT INTO attendance_records ...');
 *   });
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap liveness check used by /health and scripts/check-db.js. */
async function ping() {
  const { rows } = await query('SELECT now() AS at, current_database() AS db, current_schema() AS schema');
  return rows[0];
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  ping,
  close,
  // exported for logging/diagnostics — never includes the password
  describe: () => ({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    schema: SEARCH_PATH,
    ssl: config.ssl ? (config.ssl.rejectUnauthorized ? 'verified' : 'unverified') : 'off',
  }),
};
