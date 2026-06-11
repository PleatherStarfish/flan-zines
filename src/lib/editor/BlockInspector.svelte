<script lang="ts">
	import { untrack } from 'svelte';
	import type { EditorStore } from './store.svelte';
	import type { Element } from '$lib/zine/schema/document';
	import { getBlock } from '$lib/zine/registry';
	import type { TextFrameTarget } from '$lib/zine/schema/block';
	import type { BlockStyle, TextKind } from '$lib/zine/schema/theme';
	import { textKindForElement } from '$lib/zine/render/typeset';

	let { store, element }: { store: EditorStore; element: Element } = $props();

	const liveElement = $derived.by(() => {
		for (const act of store.doc.acts) {
			for (const scene of act.scenes) {
				const candidate = scene.elements.find((item) => item.id === element.id);
				if (candidate) return candidate;
			}
		}
		return element;
	});
	const liveScene = $derived.by(() => {
		for (const act of store.doc.acts) {
			for (const scene of act.scenes) {
				if (scene.elements.some((item) => item.id === liveElement.id)) return scene;
			}
		}
		return null;
	});
	const block = $derived(liveElement.block);
	const def = $derived(getBlock(block.type)!);
	const Inspector = $derived(def.Inspector);
	// A speech balloon attaches to a *visual subject* — the character or thing that is
	// "speaking". Only image/character blocks qualify as speakers; text, buttons, and
	// structural blocks are never offered as attachment targets.
	const frameTargetOptions = $derived.by((): TextFrameTarget[] => {
		const scene = liveScene;
		if (!scene) return [];
		return scene.elements
			.filter(
				(item) =>
					item.id !== liveElement.id &&
					(item.block.type === 'image' || item.block.type === 'characterSprite')
			)
			.map((item) => ({
				id: item.id,
				type: item.block.type,
				label: targetLabel(item)
			}));
	});

	// Local working copy so the user can type freely; only VALID changes are committed
	// to the document (the contract: inspector writes never corrupt). Keyed by block id
	// in the host, so this re-initialises on selection change.
	let working = $state<unknown>(untrack(() => $state.snapshot(block.props)));
	let error = $state<string | null>(null);

	function onChange(next: unknown): void {
		working = next;
		const result = def.schema.safeParse(next);
		if (result.success) {
			error = null;
			store.updateBlockProps(element.id, result.data);
		} else {
			error = result.error.issues[0]?.message ?? 'Please check this field.';
		}
	}

	const aligns: { v: NonNullable<BlockStyle['align']>; l: string }[] = [
		{ v: 'left', l: 'Left' },
		{ v: 'center', l: 'Center' },
		{ v: 'right', l: 'Right' },
		{ v: 'justify', l: 'Even edges' }
	];

	// Editorial typesetting (text blocks only). Student-facing labels avoid jargon; roles are
	// filtered to the ones that suit the block.
	const isTextBlock = $derived(block.type === 'heading' || block.type === 'richText');
	const textKind = $derived(textKindForElement(liveElement));

	function setTextKind(kind: TextKind): void {
		store.setTextKind(element.id, kind);
	}

	function updateStyle(next: BlockStyle): void {
		store.updateBlockStyle(element.id, next);
	}

	function setAlign(align: NonNullable<BlockStyle['align']>): void {
		updateStyle({ ...(block.style ?? {}), align });
	}

	function targetLabel(element: Element): string {
		const def = getBlock(element.block.type);
		const prefix = def?.label ?? element.block.type;
		const detail = blockDetail(element.block.type, element.block.props);
		return truncate(detail ? `${prefix}: ${detail}` : prefix, 44);
	}

	function blockDetail(type: string, props: unknown): string {
		const p = props as Record<string, unknown> | undefined;
		if (type === 'heading') return typeof p?.text === 'string' ? p.text : '';
		if (type === 'image') {
			for (const key of ['alt', 'caption', 'src']) {
				const value = p?.[key];
				if (typeof value === 'string' && value.trim()) return value.trim();
			}
		}
		if (type === 'richText') return firstText(p?.doc);
		return '';
	}

	function firstText(node: unknown): string {
		if (!node || typeof node !== 'object') return '';
		const n = node as { text?: unknown; content?: unknown[] };
		if (typeof n.text === 'string') return n.text.trim();
		if (!Array.isArray(n.content)) return '';
		return n.content.map(firstText).find((text) => text.length > 0) ?? '';
	}

	function truncate(value: string, max: number): string {
		const compact = value.replace(/\s+/g, ' ').trim();
		return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact;
	}
</script>

<div class="block-inspector">
	<section class="content-panel">
		<div class="block-inspector__heading">
			<h3>Content</h3>
			<p>Change the words, link, or image this clip shows.</p>
		</div>
		<Inspector
			value={working}
			{onChange}
			style={block.style}
			onStyleChange={updateStyle}
			{textKind}
			onTextKindChange={setTextKind}
			theme={store.doc.theme}
			{frameTargetOptions}
		/>
		{#if error}<p role="alert" class="block-inspector__error">{error}</p>{/if}
	</section>

	{#if !isTextBlock}
		<details class="rail-disclosure">
			<summary>
				<span>Position</span>
				<strong>{block.style?.align ?? 'left'}</strong>
			</summary>
			<div class="alignment-buttons" role="group" aria-label="Alignment">
				{#each aligns as a (a.v)}
					<button
						type="button"
						aria-pressed={block.style?.align === a.v || (!block.style?.align && a.v === 'left')}
						onclick={() => setAlign(a.v)}
					>
						{a.l}
					</button>
				{/each}
			</div>
		</details>
	{/if}

	<details class="rail-disclosure rail-disclosure--danger">
		<summary>Remove</summary>
		<button
			type="button"
			onclick={() => store.removeBlock(element.id)}
			class="block-inspector__delete"
		>
			Delete this block
		</button>
	</details>
</div>

<style>
	.block-inspector {
		display: grid;
		gap: 0.75rem;
	}
	.content-panel {
		display: grid;
		gap: 0.55rem;
	}
	.block-inspector__heading {
		display: grid;
		gap: 0.15rem;
	}
	.block-inspector h3 {
		margin: 0;
		color: hsl(var(--foreground));
		font-size: 0.88rem;
		font-weight: 900;
	}
	.block-inspector__heading p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.78rem;
		line-height: 1.35;
	}
	.block-inspector :global(input),
	.block-inspector :global(textarea),
	.block-inspector :global(select) {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		color: hsl(var(--foreground));
	}
	.rail-disclosure {
		border: 2px solid oklch(0.24 0.065 281 / 0.34);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.55rem 0.65rem;
	}
	.rail-disclosure summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		gap: 0.45rem;
		align-items: center;
		cursor: pointer;
		color: hsl(var(--foreground));
		font-size: 0.8rem;
		font-weight: 850;
	}
	.rail-disclosure summary strong {
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.12rem 0.38rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.7rem;
		font-weight: 800;
	}
	.rail-disclosure[open] {
		box-shadow: 0.1rem 0.1rem 0 oklch(0.24 0.065 281 / 0.28);
	}
	.rail-disclosure[open] summary {
		margin-bottom: 0.55rem;
	}
	.alignment-buttons {
		display: flex;
		gap: 0.35rem;
	}
	.alignment-buttons button {
		flex: 1 1 auto;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.42rem 0.55rem;
		color: hsl(var(--foreground));
		font-size: 0.82rem;
		font-weight: 850;
	}
	.alignment-buttons button[aria-pressed='true'] {
		background: var(--pixel-green);
	}
	.block-inspector__error {
		margin: 0.2rem 0 0;
		color: hsl(var(--destructive));
		font-size: 0.84rem;
		font-weight: 750;
	}
	.block-inspector__delete {
		justify-self: start;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.98 0.025 25);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--destructive));
		padding: 0.42rem 0.65rem;
		font-size: 0.86rem;
		font-weight: 850;
	}
	summary:focus-visible,
	button:focus-visible,
	.block-inspector :global(input:focus-visible),
	.block-inspector :global(textarea:focus-visible),
	.block-inspector :global(select:focus-visible) {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
