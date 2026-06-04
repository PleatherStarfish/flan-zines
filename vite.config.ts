import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Step 0 tests are pure TS (helpers + guards), so the node environment is
		// enough. Component tests (jsdom + @testing-library/svelte) arrive in Step 2.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/unit/**/*.{test,spec}.{js,ts}']
	}
});
