// Applies db/migrations/*.sql in order, once each. Usage:
//   DATABASE_URL=postgres://... node scripts/migrate.mjs [--seed] [--reset]
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const args = new Set(process.argv.slice(2));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  if (args.has('--reset')) {
    await client.query('drop schema public cascade; create schema public;');
  }
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(root, 'db', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await client.query('select 1 from schema_migrations where name = $1', [f]);
    if (done.rowCount) continue;
    await client.query('begin');
    await client.query(await readFile(path.join(dir, f), 'utf8'));
    await client.query('insert into schema_migrations (name) values ($1)', [f]);
    await client.query('commit');
    console.log('applied', f);
  }
  if (args.has('--seed')) {
    const { rows } = await client.query('select count(*)::int as n from activities');
    if (rows[0].n === 0) {
      await client.query(await readFile(path.join(root, 'db', 'seed.sql'), 'utf8'));
      console.log('seeded placeholder schedule');
    } else {
      console.log('activities already present, seed skipped');
    }
  }
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
