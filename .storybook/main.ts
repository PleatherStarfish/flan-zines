import type { StorybookConfig } from '@storybook/sveltekit';

// Block-development + visual-review surface. Stories live next to each block's
// Render component (one story file per block) plus a full-document ZineRenderer
// story. Kept addon-light so it boots fast on Node 18; the a11y addon can be added
// in Step 6's audit pass.
const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(ts|svelte)'],
	addons: [],
	framework: { name: '@storybook/sveltekit', options: {} },
	// No anonymous usage telemetry — consistent with the project's minimal-data,
	// student-privacy posture (REQUIREMENTS C3).
	core: { disableTelemetry: true }
};

export default config;
