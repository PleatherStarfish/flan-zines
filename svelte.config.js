import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node gives a deterministic local/CI build. Swap to
		// @sveltejs/adapter-vercel at deploy time (Step 5) for ISR + CDN.
		adapter: adapter()
	}
};

export default config;
