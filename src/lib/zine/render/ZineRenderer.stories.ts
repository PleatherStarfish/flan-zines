import type { Meta, StoryObj } from '@storybook/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { parseDocument } from '../schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '../fixtures';

const meta = {
	title: 'Zine/ZineRenderer',
	component: ZineRenderer
} satisfies Meta<typeof ZineRenderer>;
export default meta;

type Story = StoryObj<typeof meta>;

// The full sample document, rendered exactly as the public page renders it.
export const Sample: Story = {
	args: { document: parseDocument(sampleZineRaw), title: sampleZineMeta.title }
};
