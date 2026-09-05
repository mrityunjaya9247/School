#!/usr/bin/env node
// Connection smoke test:  npm run db:check
//
// Verifies the .env credentials actually reach your database, then reports
// what it found — schema present? tables created? seeded? — so you know
// exactly which step to do next. Diagnoses the common failure modes rather
// than dumping a raw stack trace.
'use strict';

const db = require('../src/db');

const EXPECTED_TABLES = 25;

function diagnose(err) {
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();

  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || msg.includes('timeout')) {
    return [
      'Could not reach the database at all.',
      '',
      'This is almost always the security group, not your password:',
      '  1. RDS console -> your instance -> Connectivity & security',
      '  2. Click the VPC security group -> Inbound rules -> Edit',
      '  3. Add: Type=PostgreSQL, Port=5432, Source=My IP',
      '',
      'Also confirm "Public access" is set to Yes on the instance,',
      'and that DB_HOST has no https:// prefix and no :5432 suffix.',
      '',
      'Note: your home IP changes when the router reconnects, so a rule',
      'that worked last week may need re-adding.',
    ];
  }
  if (code === 'ENOTFOUND') {
    return [
      'The hostname in DB_HOST does not resolve.',
      'Copy the Endpoint exactly from the RDS console — it ends in',
      '.rds.amazonaws.com and has no protocol or port attached.',
    ];
  }
  if (code === '28P01' || msg.includes('password authentication failed')) {
    return [
      'Reached the server, but the username/password was rejected.',
      'Check DB_USER and DB_PASSWORD against the master credentials you',
      'set when creating the instance. (You can reset the master password',
      'from RDS -> Modify if you no longer have it.)',
    ];
  }
  if (code === '3D000' || msg.includes('does not exist')) {
    return [
      `Database "${db.describe().database}" does not exist on that server.`,
      'If you left "Initial database name" blank at setup, AWS created one',
      'called `postgres` — set DB_NAME=postgres.',
    ];
  }
  if (msg.includes('no pg_hba.conf entry') || msg.includes('ssl')) {
    return [
      'SSL negotiation problem.',
      'For RDS keep DB_SSL=true. For a local Postgres set DB_SSL=false.',
    ];
  }
  return ['Unexpected error — full detail above.'];
}

(async () => {
  const cfg = db.describe();
  console.log('\n  Connecting to');
  console.log(`    host    ${cfg.host}:${cfg.port}`);
  console.log(`    db      ${cfg.database}`);
  console.log(`    user    ${cfg.user}`);
  console.log(`    schema  ${cfg.schema}`);
  console.log(`    ssl     ${cfg.ssl}\n`);

  try {
    const info = await db.ping();
    console.log('  [ok] connected');
    console.log(`       server time: ${info.at}`);

    // Is the schema there?
    const { rows: schemaRows } = await db.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [cfg.schema]);
    if (!schemaRows.length) {
      console.log(`\n  [!] schema "${cfg.schema}" not found — the tables have not been created yet.`);
      console.log('      Load it with:');
      console.log(`      psql -h ${cfg.host} -U ${cfg.user} -d ${cfg.database} -f ../database_schema.sql\n`);
      await db.close();
      process.exit(0);
    }

    // How many tables, and are they populated?
    const { rows: tableRows } = await db.query(
      'SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1', [cfg.schema]);
    const tableCount = tableRows[0].n;
    console.log(`  [ok] schema "${cfg.schema}" has ${tableCount} tables` +
                (tableCount === EXPECTED_TABLES ? '' : `  (expected ${EXPECTED_TABLES})`));

    const { rows: counts } = await db.query(`
      SELECT (SELECT count(*) FROM schools)  AS schools,
             (SELECT count(*) FROM staff)    AS staff,
             (SELECT count(*) FROM classes)  AS classes,
             (SELECT count(*) FROM students) AS students`);
    const c = counts[0];
    console.log(`  [ok] rows: ${c.schools} schools, ${c.staff} staff, ${c.classes} classes, ${c.students} students`);

    if (Number(c.schools) === 0) {
      console.log('\n  Tables exist but are empty. Load the sample data with:');
      console.log(`      psql -h ${cfg.host} -U ${cfg.user} -d ${cfg.database} -f ../sample_data.sql`);
    } else {
      const { rows: schools } = await db.query('SELECT id, name FROM schools ORDER BY id');
      console.log('\n  Schools found:');
      schools.forEach(s => console.log(`      ${s.id.padEnd(10)} ${s.name}`));
      console.log('\n  Everything is wired up correctly.');
    }
    console.log('');
    await db.close();
    process.exit(0);

  } catch (err) {
    console.error(`  [fail] ${err.message}`);
    if (err.code) console.error(`         code: ${err.code}`);
    console.error('');
    diagnose(err).forEach(line => console.error(`  ${line}`));
    console.error('');
    await db.close().catch(() => {});
    process.exit(1);
  }
})();
