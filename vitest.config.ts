import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/signup_test?host=/tmp',
      DATABASE_POOL_MAX: '25',
      MESSAGING_CAPTURE: '1',
      SESSION_SECRET: 'test-secret-test-secret-test-secret-123',
    },
    fileParallelism: false,
  },
});
