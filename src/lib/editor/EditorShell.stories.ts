import type { Meta, StoryObj } from '@storybook/svelte';
import EditorShell from './EditorShell.svelte';
import { EditorStore } from './store.svelte';
import { parseDocument } from '$lib/zine/schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '$lib/zine/fixtures';
import type { SaveResult } from './autosave';

// The editor mounted on the sample document with an in-memory (no-network) save, so
// the full authoring UI can be reviewed without a backend.
const meta = {
	title: 'Editor/EditorShell',
	component: EditorShell,
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof EditorShell>;
export default meta;

type Story = StoryObj<typeof meta>;

const store = new EditorStore({
	document: parseDocument(sampleZineRaw),
	zineId: 'storybook-demo',
	baseUpdatedAt: null,
	save: async (): Promise<SaveResult> => ({
		ok: true,
		clientRev: 1,
		updatedAt: new Date().toISOString()
	})
});

export const Editing: Story = { args: { store, title: sampleZineMeta.title } };
