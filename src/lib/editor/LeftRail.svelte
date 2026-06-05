<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import { allBlocks } from '$lib/zine/registry';
	import { FONT_PAIRS, PALETTES, paletteById } from '$lib/zine/theme/registry';
	import type { SceneType } from '$lib/zine/schema/document';

	let { store }: { store: EditorStore } = $props();

	let tab = $state<'add' | 'outline' | 'theme'>('add');

	const typeLabels: Record<SceneType, string> = {
		page: 'Page',
		feature: 'Feature',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};
	const addableScenes: SceneType[] = ['page', 'feature', 'reveal'];
	const palette = allBlocks().map((d) => ({ type: d.type, label: d.label }));
	const blockLabelByType = new Map(palette.map((block) => [block.type, block.label]));

	const targetSceneId = $derived(
		store.selectedBlock?.sceneId ??
			store.selectedScene?.id ??
			store.doc.acts.at(-1)?.scenes.at(-1)?.id ??
			null
	);

	function addBlock(type: string) {
		if (!targetSceneId) return;
		store.addBlock(targetSceneId, type, store.selectedBlock?.element.id);
	}

	const currentPalette = $derived(paletteById(store.doc.theme?.palette));
	const currentAccent = $derived(store.doc.theme?.accent ?? currentPalette.accents[0]);
</script>

<div class="flex h-full flex-col">
	<div class="flex border-b border-border text-sm" role="tablist">
		{#each [{ id: 'add', l: 'Add' }, { id: 'outline', l: 'Outline' }, { id: 'theme', l: 'Theme' }] as t (t.id)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t.id}
				onclick={() => (tab = t.id as typeof tab)}
				class="flex-1 px-2 py-2 {tab === t.id
					? 'border-b-2 border-primary font-medium text-foreground'
					: 'text-muted-foreground'}"
			>
				{t.l}
			</button>
		{/each}
	</div>

	<div class="flex-1 overflow-y-auto p-3">
		{#if tab === 'add'}
			<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Block</p>
			{#if !targetSceneId}
				<p class="mb-2 text-xs text-muted-foreground">Add a scene first.</p>
			{/if}
			<div class="grid grid-cols-2 gap-2">
				{#each palette as item (item.type)}
					<button
						type="button"
						disabled={!targetSceneId}
						onclick={() => addBlock(item.type)}
						class="rounded-md border border-border px-2 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
					>
						{item.label}
					</button>
				{/each}
			</div>

			<p class="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Scene
			</p>
			<div class="grid grid-cols-2 gap-2">
				{#each addableScenes as type (type)}
					<button
						type="button"
						onclick={() => store.addScene(undefined, type)}
						class="rounded-md border border-dashed border-border px-2 py-2 text-sm text-foreground hover:bg-muted"
					>
						+ {typeLabels[type]}
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => store.addAct('New chapter')}
				class="mt-2 w-full rounded-md border border-dashed border-border px-2 py-2 text-sm text-foreground hover:bg-muted"
			>
				+ Chapter
			</button>
		{:else if tab === 'outline'}
			{#if store.doc.acts.length === 0}
				<p class="text-sm text-muted-foreground">No scenes yet. Add one from the Add tab.</p>
			{/if}
			<ul class="space-y-3">
				{#each store.doc.acts as act (act.id)}
					<li>
						<div
							class="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>
							{act.title || 'Chapter'}
						</div>
						{#each act.scenes as scene (scene.id)}
							<button
								type="button"
								onclick={() => store.select(scene.id)}
								class="w-full rounded-md px-2 py-1 text-left text-sm font-medium {store.selectedId ===
								scene.id
									? 'bg-muted text-foreground'
									: 'text-foreground hover:bg-muted'}"
							>
								{scene.label || typeLabels[scene.type]}
								<span class="text-xs text-muted-foreground">· {scene.type}</span>
							</button>
							<ul class="ml-3 mt-1 space-y-0.5 border-l border-border pl-2">
								{#each scene.elements as element (element.id)}
									<li class="flex items-center gap-1">
										<button
											type="button"
											onclick={() => store.select(element.id)}
											class="flex-1 truncate rounded px-1.5 py-1 text-left text-xs {store.selectedId ===
											element.id
												? 'bg-muted text-foreground'
												: 'text-muted-foreground hover:bg-muted'}"
										>
											{blockLabelByType.get(element.block.type) ?? element.block.type}
										</button>
										<button
											type="button"
											aria-label="Move up"
											onclick={() => store.moveBlock(element.id, 'up')}
											class="px-1 text-xs text-muted-foreground hover:text-foreground">↑</button
										>
										<button
											type="button"
											aria-label="Move down"
											onclick={() => store.moveBlock(element.id, 'down')}
											class="px-1 text-xs text-muted-foreground hover:text-foreground">↓</button
										>
									</li>
								{/each}
								{#if scene.elements.length === 0}
									<li class="px-1.5 py-1 text-xs text-muted-foreground">empty</li>
								{/if}
							</ul>
						{/each}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Palette
			</p>
			<div class="grid grid-cols-2 gap-2">
				{#each PALETTES as p (p.id)}
					<button
						type="button"
						aria-pressed={(store.doc.theme?.palette ?? 'ink') === p.id}
						onclick={() => store.setTheme({ palette: p.id, accent: p.accents[0] })}
						class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted aria-pressed:border-primary"
					>
						<span class="h-4 w-4 rounded-full border border-border" style:background={p.bg}></span>
						{p.label}
					</button>
				{/each}
			</div>

			<p class="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Accent
			</p>
			<div class="flex gap-2">
				{#each currentPalette.accents as accent (accent)}
					<button
						type="button"
						aria-label={`Accent ${accent}`}
						aria-pressed={currentAccent === accent}
						onclick={() => store.setTheme({ accent })}
						class="h-7 w-7 rounded-full border-2 {currentAccent === accent
							? 'border-foreground'
							: 'border-transparent'}"
						style:background={accent}
					></button>
				{/each}
			</div>

			<p class="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Fonts
			</p>
			<select
				value={store.doc.theme?.fontPair ?? 'editorial'}
				onchange={(e) => store.setTheme({ fontPair: e.currentTarget.value })}
				class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
			>
				{#each FONT_PAIRS as f (f.id)}
					<option value={f.id}>{f.label}</option>
				{/each}
			</select>
		{/if}
	</div>
</div>
