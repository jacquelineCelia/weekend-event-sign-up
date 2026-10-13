import { execFileSync } from 'node:child_process';

// Rebuilds the test database from the migrations before the suite runs.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/signup_test?host=/tmp';
  execFileSync('node', ['scripts/migrate.mjs', '--reset'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
