import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Pure-TS unit tests + the Postgres-backed RLS/migration suites both run in
		// node. The DB suites skip themselves unless SUPABASE_DB_URL is set (see
		// tests/db/harness.ts). Component tests (jsdom) arrive in Step 2.
		environment: 'node',
		include: [
			'src/**/*.{test,spec}.{js,ts}',
			'tests/unit/**/*.{test,spec}.{js,ts}',
			'tests/rls/**/*.{test,spec}.{js,ts}',
			'tests/migrations/**/*.{test,spec}.{js,ts}'
		],
		// Applying migrations + seed to a fresh database needs more than the default.
		testTimeout: 30_000,
		hookTimeout: 60_000,
		// The RLS and migration suites share one Postgres and each resets it in a
		// beforeAll; run files sequentially so they never stomp on each other.
		fileParallelism: false
	}
});
