<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import { SCENE_TYPES, type Scene, type SceneType } from '$lib/zine/schema/document';

	let { store, section }: { store: EditorStore; section: Scene } = $props();

	const typeLabels: Record<SceneType, string> = {
		page: 'Page (just writing)',
		feature: 'Feature (big picture)',
		reveal: 'Reveal (Step 4 timeline)',
		parallax: 'Parallax (Step 4 timeline)',
		sidescroll: 'Side-scroll (Step 4 timeline)',
		data: 'Data (Step 5)'
	};
</script>

<div class="space-y-4">
	<label class="block">
		<span class="text-sm font-medium text-foreground"
			>Scene name <span class="text-muted-foreground">(just for you)</span></span
		>
		<input
			type="text"
			value={section.label ?? ''}
			placeholder="e.g. Intro"
			oninput={(e) => store.setSceneLabel(section.id, e.currentTarget.value)}
			class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
		/>
	</label>

	<label class="block">
		<span class="text-sm font-medium text-foreground">Type</span>
		<select
			value={section.type}
			onchange={(e) => store.setSceneType(section.id, e.currentTarget.value as SceneType)}
			class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
		>
			{#each SCENE_TYPES as type (type)}
				<option value={type} disabled={type === 'data'}>{typeLabels[type]}</option>
			{/each}
		</select>
	</label>

	<div class="flex gap-2">
		<button
			type="button"
			onclick={() => store.moveScene(section.id, 'up')}
			class="flex-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted"
		>
			↑ Move up
		</button>
		<button
			type="button"
			onclick={() => store.moveScene(section.id, 'down')}
			class="flex-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted"
		>
			↓ Move down
		</button>
	</div>

	<button
		type="button"
		onclick={() => store.removeScene(section.id)}
		class="text-sm font-medium text-red-700 hover:underline"
	>
		Delete this scene
	</button>
</div>
