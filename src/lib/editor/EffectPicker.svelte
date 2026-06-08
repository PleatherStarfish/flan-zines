<script lang="ts">
	import { DEFAULT_WAYPOINTS } from '$lib/zine/animations/path';
	import { effectsForSlot, getBlock, getEffect } from '$lib/zine/registry';
	import type { AnyAnimationDef, EffectSlot } from '$lib/zine/schema/animation';
	import type { Element } from '$lib/zine/schema/document';
	import { textKindForElement } from '$lib/zine/render/typeset';
	import type { EditorStore } from './store.svelte';

	// The rail should answer one question at a time. Effects are mutually exclusive per slot,
	// so a select is calmer than a wall of chips; deeper knobs stay folded until requested.
	let {
		store,
		element,
		onEditPath
	}: { store: EditorStore; element: Element; onEditPath?: (elementId: string) => void } = $props();

	type SlotSection = { slot: EffectSlot; title: string; group: AnyAnimationDef['group'] };
	const sections: SlotSection[] = [
		{ slot: 'enter', title: 'Appears', group: 'appear' },
		{ slot: 'motion', title: 'Moves while visible', group: 'motion' },
		{ slot: 'exit', title: 'Leaves', group: 'appear' }
	];

	const allowed = $derived(new Set(getBlock(element.block.type)?.allowedAnimations ?? []));
	const textKind = $derived(textKindForElement(element));
	const anyOptions = $derived(sections.some((section) => optionsFor(section).length > 0));

	function optionsFor(section: SlotSection): AnyAnimationDef[] {
		if (textKind === 'content' && section.slot === 'motion') return [];
		const options = effectsForSlot(section.slot, section.group).filter((def) =>
			allowed.has(def.type)
		);
		if (element.placement === 'pinned' && section.slot === 'motion') {
			if (element.track !== 'background') return [];
			return options.filter((def) => def.type === 'parallax');
		}
		return options;
	}

	function currentType(slot: EffectSlot): string | null {
		return element[slot]?.type ?? null;
	}

	function activeLabel(slot: EffectSlot, options: AnyAnimationDef[]): string {
		const active = currentType(slot);
		if (!active) return 'None';
		if (slot === 'motion' && active === 'parallax' && element.placement === 'pinned') {
			const direction = element.motion?.params?.direction === 'down' ? 'down' : 'up';
			return `Drift ${direction}`;
		}
		return options.find((def) => def.type === active)?.label ?? getEffect(active)?.label ?? active;
	}

	function sectionTitle(section: SlotSection): string {
		if (
			section.slot === 'motion' &&
			element.placement === 'pinned' &&
			element.track === 'background'
		) {
			return 'Backdrop drift';
		}
		return section.title;
	}

	function knobValue(slot: EffectSlot, def: AnyAnimationDef, key: string): string {
		const params =
			element[slot]?.type === def.type
				? (element[slot]?.params ?? {})
				: (def.defaults as Record<string, unknown>);
		const value = (params as Record<string, unknown>)[key];
		return typeof value === 'string' ? value : '';
	}

	function chooseEffect(slot: EffectSlot, def: AnyAnimationDef | null): void {
		if (!def) {
			store.setElementEffect(element.id, slot, undefined);
			if (slot === 'motion' && element.placement === 'free') {
				store.setElementPlacement(element.id, undefined);
			}
			return;
		}
		if (def.editor === 'path') {
			store.setElementPath(element.id, structuredClone(DEFAULT_WAYPOINTS));
			store.updateElementRange(element.id, { start: 0, end: 1 });
			onEditPath?.(element.id);
			return;
		}
		store.setElementEffect(element.id, slot, {
			type: def.type,
			params: structuredClone(def.defaults) as Record<string, unknown>
		});
	}

	function chooseType(slot: EffectSlot, options: AnyAnimationDef[], value: string): void {
		chooseEffect(
			slot,
			value === 'none' ? null : (options.find((def) => def.type === value) ?? null)
		);
	}

	function setKnob(slot: EffectSlot, def: AnyAnimationDef, key: string, value: string): void {
		const base =
			element[slot]?.type === def.type
				? (element[slot]?.params ?? {})
				: (def.defaults as Record<string, unknown>);
		const nextParams = { ...(base as Record<string, unknown>), [key]: value };
		const parsed = def.schema.safeParse(nextParams);
		store.setElementEffect(element.id, slot, {
			type: def.type,
			params: (parsed.success ? parsed.data : def.defaults) as Record<string, unknown>
		});
	}
</script>

<section class="effect-picker" aria-label="Animation">
	<div class="effect-picker__intro">
		<h3>Animation</h3>
		<p>Pick a simple behavior. Open fine tuning only when the timing needs a nudge.</p>
	</div>

	{#if !anyOptions}
		<p class="effect-picker__empty">This element is best left still.</p>
	{:else}
		{#each sections as section (section.slot)}
			{@const options = optionsFor(section)}
			{#if options.length > 0}
				{@const active = currentType(section.slot)}
				{@const def = active ? options.find((option) => option.type === active) : undefined}
				<details class="slot" open={Boolean(active)}>
					<summary>
						<span>{sectionTitle(section)}</span>
						<strong>{activeLabel(section.slot, options)}</strong>
					</summary>

					<label class="effect-select">
						<span>Effect</span>
						<select
							value={active ?? 'none'}
							onchange={(event) => chooseType(section.slot, options, event.currentTarget.value)}
						>
							<option value="none">No effect</option>
							{#each options as option (option.type)}
								<option value={option.type}>{option.icon} {option.label}</option>
							{/each}
						</select>
					</label>

					{#if def?.editor === 'path'}
						<button type="button" class="edit-path" onclick={() => onEditPath?.(element.id)}>
							Edit the path
						</button>
					{:else if def?.knobs.length}
						<details class="slot__tweaks">
							<summary>Fine tune</summary>
							{#each def.knobs as knob (knob.key)}
								<div class="knob" role="group" aria-label={knob.label}>
									<span class="knob__label">{knob.label}</span>
									<div class="knob__options">
										{#each knob.options as option (option.value)}
											<button
												type="button"
												aria-pressed={knobValue(section.slot, def, knob.key) === option.value}
												onclick={() => setKnob(section.slot, def, knob.key, option.value)}
											>
												{option.label}
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</details>
					{/if}
				</details>
			{/if}
		{/each}
	{/if}
</section>

<style>
	.effect-picker {
		display: grid;
		gap: 0.65rem;
	}
	.effect-picker__intro {
		display: grid;
		gap: 0.2rem;
	}
	.effect-picker__intro h3 {
		margin: 0;
		font-size: 0.86rem;
		font-weight: 900;
		color: hsl(var(--foreground));
	}
	.effect-picker__intro p,
	.effect-picker__empty {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.78rem;
		line-height: 1.35;
	}
	.slot {
		border: 2px solid oklch(0.24 0.065 281 / 0.34);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.55rem 0.65rem;
	}
	.slot[open] {
		box-shadow: 0.1rem 0.1rem 0 oklch(0.24 0.065 281 / 0.28);
	}
	.slot summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.45rem;
		cursor: pointer;
	}
	.slot summary span {
		font-size: 0.8rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.slot summary strong {
		overflow: hidden;
		max-width: 8.5rem;
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.12rem 0.38rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.7rem;
		font-weight: 800;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.effect-select {
		display: grid;
		gap: 0.3rem;
		margin-top: 0.55rem;
	}
	.effect-select span,
	.knob__label {
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		font-weight: 800;
	}
	.effect-select select {
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.48rem 0.55rem;
		color: hsl(var(--foreground));
		font-size: 0.82rem;
		font-weight: 780;
	}
	.slot__tweaks {
		margin-top: 0.6rem;
		border-top: 2px dashed oklch(0.24 0.065 281 / 0.28);
		padding-top: 0.5rem;
	}
	.slot__tweaks[open] {
		box-shadow: none;
	}
	.slot__tweaks summary {
		display: block;
		color: hsl(var(--muted-foreground));
		font-size: 0.76rem;
		font-weight: 850;
	}
	.slot__tweaks[open] summary {
		margin-bottom: 0.55rem;
	}
	.knob {
		display: grid;
		gap: 0.35rem;
	}
	.knob + .knob {
		margin-top: 0.55rem;
	}
	.knob__options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.knob__options button {
		flex: 1 1 auto;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.35rem 0.4rem;
		color: hsl(var(--foreground));
		font-size: 0.76rem;
		font-weight: 850;
	}
	.knob__options button[aria-pressed='true'] {
		background: var(--pixel-cyan);
	}
	.edit-path {
		margin-top: 0.6rem;
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-magenta);
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
		padding: 0.5rem;
		color: hsl(var(--primary-foreground));
		font-size: 0.84rem;
		font-weight: 900;
	}
	summary:focus-visible,
	select:focus-visible,
	.edit-path:focus-visible,
	.knob__options button:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
