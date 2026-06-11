import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// svelteTesting() wires @testing-library/svelte for vitest (client-build
	// resolution + auto-cleanup); it only affects test runs, not build/dev.
	plugins: [sveltekit(), svelteTesting()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes('/node_modules/roughjs/') ||
						id.includes('/node_modules/hachure-fill/') ||
						id.includes('/node_modules/path-data-parser/') ||
						id.includes('/node_modules/points-on-curve/') ||
						id.includes('/node_modules/points-on-path/')
					) {
						return 'rough-text-frame';
					}
				}
			}
		}
	},
	worker: { format: 'es' },
	// Distinctive high ports so this project never collides with other local servers
	// (storybook runs on 38410; e2e preview on 38420 — see playwright.config.ts).
	server: { port: 38400, strictPort: true },
	preview: { port: 38420, strictPort: true },
	test: {
		// Default to node for the pure-TS unit, RLS, and migration suites. Component
		// tests opt into jsdom per-file with `// @vitest-environment jsdom` and mount
		// blocks via @testing-library/svelte, then assert + run axe on the result.
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
