<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import BackgroundPicker from './BackgroundPicker.svelte';
	import {
		SCENE_TYPES,
		sceneScrollScreens,
		type Scene,
		type SceneType
	} from '$lib/zine/schema/document';

	let { store, section }: { store: EditorStore; section: Scene } = $props();

	const screens = $derived(sceneScrollScreens(section));
	const axis = $derived(section.scrollAxis ?? 'vertical');

	const typeLabels: Record<SceneType, string> = {
		page: 'Page (just writing)',
		feature: 'Feature (big picture)',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};

	function deleteScene(): void {
		if (confirm('Delete this scene?')) store.removeScene(section.id);
	}
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

	{#if section.type !== 'page'}
		<div class="block" role="group" aria-label="Scroll direction">
			<span class="text-sm font-medium text-foreground">Scroll direction</span>
			<div class="mt-1 flex gap-1">
				<button
					type="button"
					aria-pressed={axis === 'vertical'}
					onclick={() => store.setSceneScrollAxis(section.id, 'vertical')}
					class="flex-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted aria-pressed:border-primary aria-pressed:bg-muted"
				>
					↓ Down
				</button>
				<button
					type="button"
					aria-pressed={axis === 'horizontal'}
					onclick={() => store.setSceneScrollAxis(section.id, 'horizontal')}
					class="flex-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted aria-pressed:border-primary aria-pressed:bg-muted"
				>
					→ Sideways
				</button>
			</div>
			<span class="mt-1 block text-xs text-muted-foreground">
				Sideways turns this scene into a side-scroller — the page scrolls down while the scene pans
				across.
			</span>
		</div>

		<label class="block">
			<span class="text-sm font-medium text-foreground">
				Scroll length
				<span class="text-muted-foreground">({screens} {screens === 1 ? 'screen' : 'screens'})</span
				>
			</span>
			<input
				type="range"
				aria-label="Scroll length in screens"
				min="1"
				max="12"
				step="1"
				value={screens}
				oninput={(e) => store.setSceneScroll(section.id, Number(e.currentTarget.value))}
				class="mt-2 w-full accent-primary"
			/>
			<span class="mt-1 block text-xs text-muted-foreground">
				How far the reader scrolls through this scene while its effects play out.
			</span>
		</label>
	{/if}

	<div class="border-t border-border pt-3">
		<BackgroundPicker {store} {section} />
	</div>

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
		onclick={deleteScene}
		class="text-sm font-medium text-red-700 hover:underline"
	>
		Delete this scene
	</button>
</div>
