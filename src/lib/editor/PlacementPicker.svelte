<script lang="ts">
	import { PIN_REGIONS, type Element, type PinRegion, type Scene } from '$lib/zine/schema/document';
	import { textKindForElement } from '$lib/zine/render/typeset';
	import type { EditorStore } from './store.svelte';

	// Screen placement for freer actors: text only reaches this picker after the author chooses
	// Other text. Content text keeps editorial flow + typesetting and skips placement choreography.
	// Free sprites are managed via Animation (the path editor), so this picker leaves them alone.
	// Pinned controls speak a student's language: a 3×3 grid + "move left/right/up/down", no
	// "padding"/"anchor" jargon.
	let { store, element, scene }: { store: EditorStore; element: Element; scene: Scene } = $props();

	// Read the LIVE element so region/nudge presses reflect immediately.
	const live = $derived.by(() => {
		for (const act of store.doc.acts) {
			for (const s of act.scenes) {
				const found = s.elements.find((candidate) => candidate.id === element.id);
				if (found) return found;
			}
		}
		return element;
	});
	const placement = $derived(live.placement ?? 'flow');
	const textKind = $derived(textKindForElement(live));
	const speechFrame = $derived(
		live.block.style?.textFrame?.kind === 'speech' ? live.block.style.textFrame : undefined
	);
	const hasSpeechTarget = $derived(Boolean(speechFrame?.speakerElementId));
	const region = $derived(live.anchor?.region ?? 'center');
	const nudged = $derived((live.anchor?.dx ?? 0) !== 0 || (live.anchor?.dy ?? 0) !== 0);
	const canPin = $derived(store.canPin(element.id));

	const regionLabels: Record<PinRegion, string> = {
		'top-left': 'Top left',
		top: 'Top',
		'top-right': 'Top right',
		left: 'Left',
		center: 'Center',
		right: 'Right',
		'bottom-left': 'Bottom left',
		bottom: 'Bottom',
		'bottom-right': 'Bottom right'
	};
</script>

<section class="placement" aria-label="Placement">
	<div class="intro">
		<h3>
			{hasSpeechTarget
				? 'Place bubble'
				: textKind === 'other'
					? 'Place other text'
					: 'Place on screen'}
		</h3>
	</div>

	{#if placement === 'free'}
		<p class="note">This moves on a path. Edit how it travels in <strong>Animation</strong>.</p>
	{:else}
		<div class="choices" role="group" aria-label="Placement">
			<button
				type="button"
				aria-pressed={placement === 'flow'}
				onclick={() => store.setElementPlacement(element.id, undefined)}
			>
				With the scene
			</button>
			<button
				type="button"
				aria-pressed={placement === 'pinned'}
				disabled={!canPin && placement !== 'pinned'}
				onclick={() => store.setElementPlacement(element.id, 'pinned')}
			>
				Pinned to screen
			</button>
		</div>

		{#if !canPin}
			<p class="note">
				Pinned text needs to be short and link-free — larger pieces stay with the scene.
			</p>
		{/if}

		{#if placement === 'pinned'}
			{#if hasSpeechTarget}
				<button
					type="button"
					class="add-pinned"
					onclick={() => store.alignSpeechBubbleToSpeaker(element.id)}
				>
					Place near speaker
				</button>
			{/if}

			<p class="label">Place it on the screen</p>
			<div class="region-grid" role="group" aria-label="Screen position">
				{#each PIN_REGIONS as r (r)}
					<button
						type="button"
						class="region"
						aria-pressed={region === r}
						aria-label={regionLabels[r]}
						title={regionLabels[r]}
						onclick={() => store.setElementAnchorRegion(element.id, r)}
					>
						<span class="dot" aria-hidden="true"></span>
					</button>
				{/each}
			</div>

			<p class="label">Nudge</p>
			<div class="nudge">
				<button
					type="button"
					aria-label="Move up"
					onclick={() => store.nudgeAnchor(element.id, 'y', -1)}>↑</button
				>
				<div class="nudge-row">
					<button
						type="button"
						aria-label="Move left"
						onclick={() => store.nudgeAnchor(element.id, 'x', -1)}>←</button
					>
					<button
						type="button"
						class="reset"
						aria-label="Reset position"
						disabled={!nudged}
						onclick={() => store.resetAnchorNudge(element.id)}>•</button
					>
					<button
						type="button"
						aria-label="Move right"
						onclick={() => store.nudgeAnchor(element.id, 'x', 1)}>→</button
					>
				</div>
				<button
					type="button"
					aria-label="Move down"
					onclick={() => store.nudgeAnchor(element.id, 'y', 1)}>↓</button
				>
			</div>

			{#if scene.type === 'page'}
				<p class="note">Pinning makes this scene scroll.</p>
			{/if}

			<button type="button" class="add-pinned" onclick={() => store.addPinnedText(scene.id)}>
				+ Add pinned label
			</button>
			<p class="note">Each new one animates in after the last, as the reader scrolls.</p>
		{/if}
	{/if}
</section>

<style>
	.placement {
		display: grid;
		gap: 0.55rem;
	}
	.intro h3 {
		margin: 0;
		font-size: 0.86rem;
		font-weight: 900;
		color: hsl(var(--foreground));
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
	}
	.choices button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.45rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 850;
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.choices button[aria-pressed='true'] {
		background: var(--pixel-cyan);
	}
	.choices button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.label {
		margin: 0.2rem 0 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		font-weight: 800;
	}
	.note {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		line-height: 1.35;
	}
	.region-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.25rem;
		max-width: 8.5rem;
		aspect-ratio: 16 / 9;
	}
	.region {
		display: grid;
		place-items: center;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		cursor: pointer;
	}
	.region .dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: oklch(0.24 0.065 281 / 0.4);
	}
	.region[aria-pressed='true'] {
		background: var(--pixel-yellow);
	}
	.region[aria-pressed='true'] .dot {
		background: var(--pixel-ink);
	}
	.nudge {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
		max-width: 8.5rem;
	}
	.nudge-row {
		display: flex;
		gap: 0.25rem;
	}
	.nudge button {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 1.8rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow-xs);
		font-size: 0.9rem;
		font-weight: 900;
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.nudge button.reset {
		background: oklch(0.97 0.02 82);
	}
	.nudge button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.add-pinned {
		justify-self: start;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 850;
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.add-pinned:hover {
		background: var(--pixel-yellow);
	}
	button:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
