<script lang="ts">
	import { effectsForSlot, getBlock } from '$lib/zine/registry';
	import { DEFAULT_WAYPOINTS } from '$lib/zine/animations/path';
	import type { AnyAnimationDef, EffectSlot } from '$lib/zine/schema/animation';
	import type { Element } from '$lib/zine/schema/document';
	import type { EditorStore } from './store.svelte';

	// Funnel B (scene-timeline.md §6): tap a clip → pick what it should do. Each slot
	// offers "Still" + a short, picture-led list of effects (filtered to the block's
	// allowedAnimations), then at most three knob chips — Speed / Direction / Amount,
	// never a number. The exception is a deep-`editor` effect (Choreograph), which opens the
	// visual stage instead. Writes registry EffectRefs to the element's enter/exit/motion slots.
	let {
		store,
		element,
		onEditPath
	}: { store: EditorStore; element: Element; onEditPath?: (elementId: string) => void } = $props();

	type SlotSection = { slot: EffectSlot; title: string; group: AnyAnimationDef['group'] };
	const sections: SlotSection[] = [
		{ slot: 'enter', title: 'How it appears', group: 'appear' },
		{ slot: 'motion', title: 'While it’s here', group: 'motion' },
		{ slot: 'exit', title: 'How it leaves', group: 'appear' }
	];

	const allowed = $derived(new Set(getBlock(element.block.type)?.allowedAnimations ?? []));

	function optionsFor(section: SlotSection): AnyAnimationDef[] {
		return effectsForSlot(section.slot, section.group).filter((def) => allowed.has(def.type));
	}

	function currentType(slot: EffectSlot): string | null {
		return element[slot]?.type ?? null;
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
			// Leaving a path also drops the free placement so the element returns to the flow.
			if (slot === 'motion' && element.placement === 'free')
				store.setElementPlacement(element.id, undefined);
			return;
		}
		if (def.editor === 'path') {
			// Choreograph: make it a free sprite on a starter path spanning the scene, then open
			// the visual stage to author the control points.
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

	const anyOptions = $derived(sections.some((section) => optionsFor(section).length > 0));
</script>

<section class="effect-picker" aria-label="What should it do?">
	<h3>What should it do?</h3>
	{#if !anyOptions}
		<p class="effect-picker__empty">This element stays still — that’s perfect for a calm page.</p>
	{:else}
		{#each sections as section (section.slot)}
			{@const options = optionsFor(section)}
			{#if options.length > 0}
				{@const active = currentType(section.slot)}
				<div class="slot">
					<h4>{section.title}</h4>
					<div class="effect-grid" role="group" aria-label={section.title}>
						<button
							type="button"
							class="effect-chip"
							aria-pressed={active === null}
							onclick={() => chooseEffect(section.slot, null)}
						>
							<span class="effect-chip__icon" aria-hidden="true">⏺️</span>
							Still
						</button>
						{#each options as def (def.type)}
							<button
								type="button"
								class="effect-chip"
								aria-pressed={active === def.type}
								onclick={() => chooseEffect(section.slot, def)}
							>
								<span class="effect-chip__icon" aria-hidden="true">{def.icon}</span>
								{def.label}
							</button>
						{/each}
					</div>

					{#if active}
						{@const def = options.find((option) => option.type === active)}
						{#if def?.editor === 'path'}
							<button type="button" class="edit-path" onclick={() => onEditPath?.(element.id)}>
								✎ Edit the path
							</button>
						{:else if def}
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
						{/if}
					{/if}
				</div>
			{/if}
		{/each}
	{/if}
</section>

<style>
	.effect-picker {
		display: grid;
		gap: 0.9rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--background));
		padding: 0.85rem;
	}
	.effect-picker h3 {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 760;
		color: hsl(var(--foreground));
	}
	.effect-picker__empty {
		margin: 0;
		font-size: 0.82rem;
		color: hsl(var(--muted-foreground));
	}
	.slot {
		display: grid;
		gap: 0.5rem;
	}
	.slot h4 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.effect-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}
	.effect-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.45rem;
		background: hsl(var(--background));
		padding: 0.45rem 0.5rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: hsl(var(--foreground));
		text-align: left;
	}
	.effect-chip__icon {
		font-size: 1rem;
		line-height: 1;
	}
	.effect-chip[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	.knob {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem;
	}
	.knob__label {
		font-size: 0.76rem;
		font-weight: 700;
		color: hsl(var(--muted-foreground));
	}
	.knob__options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.knob__options button {
		flex: 1 1 auto;
		border: 1px solid hsl(var(--border));
		border-radius: 0.35rem;
		background: hsl(var(--background));
		padding: 0.35rem 0.4rem;
		font-size: 0.76rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.knob__options button[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	.edit-path {
		width: 100%;
		border: 1px solid hsl(var(--primary));
		border-radius: 0.45rem;
		background: hsl(var(--primary) / 0.1);
		padding: 0.5rem;
		font-size: 0.84rem;
		font-weight: 760;
		color: hsl(var(--foreground));
	}
	.effect-chip:focus-visible,
	.edit-path:focus-visible,
	.knob__options button:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
</style>
