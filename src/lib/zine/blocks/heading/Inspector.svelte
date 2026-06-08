<script lang="ts">
	import { tick, untrack } from 'svelte';
	import FocusedTextTools from '$lib/editor/FocusedTextTools.svelte';
	import { defaultContentRole } from '$lib/zine/render/typeset';
	import type { BlockStyle, TextKind, Theme } from '../../schema/theme';
	import type { HeadingProps } from './schema';

	let {
		value,
		onChange,
		style,
		onStyleChange,
		textKind = 'content',
		onTextKindChange,
		theme
	}: {
		value: HeadingProps;
		onChange: (next: HeadingProps) => void;
		style?: BlockStyle;
		onStyleChange?: (next: BlockStyle) => void;
		textKind?: TextKind;
		onTextKindChange?: (kind: TextKind) => void;
		theme?: Theme;
	} = $props();

	const levels = [
		{ value: 2, label: 'Section heading (H2)' },
		{ value: 3, label: 'Sub-heading (H3)' },
		{ value: 4, label: 'Minor heading (H4)' }
	] as const;

	let open = $state(false);
	let draft = $state<HeadingProps>(untrack(() => structuredClone($state.snapshot(value))));
	let draftStyle = $state<BlockStyle | undefined>(untrack(() => cloneStyle(style)));
	let draftTextKind = $state<TextKind>(untrack(() => textKind));
	let draftStyleDirty = $state(false);
	let draftTextKindDirty = $state(false);
	let panelEl = $state<HTMLDivElement | null>(null);
	let openButtonEl = $state<HTMLButtonElement | null>(null);

	function openEditor(): void {
		draft = structuredClone($state.snapshot(value));
		draftStyle = cloneStyle(style);
		draftTextKind = textKind;
		draftStyleDirty = false;
		draftTextKindDirty = false;
		open = true;
	}

	function closeEditor(): void {
		open = false;
		tick().then(() => openButtonEl?.focus());
	}

	function saveEditor(): void {
		onChange(draft);
		if (draftTextKindDirty) onTextKindChange?.(draftTextKind);
		if (draftStyleDirty) onStyleChange?.(draftStyle ?? {});
		closeEditor();
	}

	function cloneStyle(source: BlockStyle | undefined): BlockStyle | undefined {
		return source ? structuredClone($state.snapshot(source)) : undefined;
	}

	function setDraftStyle(next: BlockStyle): void {
		draftStyle = structuredClone($state.snapshot(next));
		draftStyleDirty = true;
	}

	function setDraftTextKind(kind: TextKind): void {
		draftTextKind = kind;
		draftTextKindDirty = true;
		draftStyleDirty = true;
		const next: BlockStyle = { ...(draftStyle ?? {}) };
		if (kind === 'other') {
			next.typeset = { kind: 'other' };
		} else {
			next.typeset = {
				...(next.typeset ?? {}),
				kind: 'content',
				role: next.typeset?.role ?? defaultContentRole('heading', draft)
			};
		}
		draftStyle = next;
	}

	function onModalKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeEditor();
			return;
		}
		if (event.key === 'Tab') trapFocus(event);
	}

	function trapFocus(event: KeyboardEvent): void {
		if (!panelEl) return;
		const focusables = Array.from(
			panelEl.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled'));
		if (!focusables.length) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<div class="heading-inspector">
	<div class="heading-inspector__preview" aria-live="polite">
		<p>{value.text}</p>
	</div>
	<button
		type="button"
		class="heading-inspector__open"
		bind:this={openButtonEl}
		onclick={openEditor}
	>
		Open focused editor
	</button>
</div>

{#if open}
	<div class="heading-modal" role="presentation">
		<div
			class="heading-modal__panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="heading-editor-title"
			tabindex="-1"
			bind:this={panelEl}
			onkeydown={onModalKeydown}
		>
			<header class="heading-modal__header">
				<div>
					<p>Focused writing</p>
					<h2 id="heading-editor-title">Edit heading</h2>
				</div>
				<div class="heading-modal__actions">
					<button type="button" class="heading-modal__ghost" onclick={closeEditor}>Cancel</button>
					<button type="button" class="heading-modal__save" onclick={saveEditor}>Save text</button>
				</div>
			</header>

			<section class="heading-fields" aria-label="Heading text">
				<label>
					<span>Heading text</span>
					<input
						type="text"
						value={draft.text}
						oninput={(e) => (draft = { ...draft, text: e.currentTarget.value })}
					/>
				</label>
				<label>
					<span>Level</span>
					<select
						value={String(draft.level)}
						onchange={(e) =>
							(draft = {
								...draft,
								level: Number(e.currentTarget.value) as HeadingProps['level']
							})}
					>
						{#each levels as level (level.value)}
							<option value={String(level.value)}>{level.label}</option>
						{/each}
					</select>
				</label>
			</section>

			<FocusedTextTools
				block={{ id: 'heading_draft', type: 'heading', props: draft }}
				style={draftStyle}
				textKind={draftTextKind}
				{theme}
				onStyleChange={setDraftStyle}
				onTextKindChange={setDraftTextKind}
			/>
		</div>
	</div>
{/if}

<style>
	.heading-inspector {
		display: grid;
		gap: 0.55rem;
	}
	.heading-inspector__preview {
		min-height: 3.8rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.6rem 0.7rem;
	}
	.heading-inspector__preview p {
		margin: 0;
		color: hsl(var(--foreground));
		font-size: 0.9rem;
		font-weight: 850;
		line-height: 1.25;
	}
	.heading-inspector__open,
	.heading-modal button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--foreground));
		font-weight: 850;
	}
	.heading-inspector__open {
		justify-self: start;
		padding: 0.48rem 0.72rem;
		font-size: 0.84rem;
	}
	.heading-modal {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		background: oklch(0.18 0.055 281 / 0.72);
		padding: 1rem;
	}
	.heading-modal__panel {
		display: grid;
		grid-template-rows: max-content max-content minmax(0, 1fr);
		width: min(72rem, calc(100vw - 2rem));
		height: min(48rem, calc(100dvh - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 3px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.055) 1px, transparent 1px),
			oklch(0.95 0.025 82);
		background-size: 14px 14px;
		box-shadow: 0.45rem 0.45rem 0 var(--pixel-ink);
	}
	.heading-modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.98 0.018 82);
		padding: 0.7rem 0.85rem;
	}
	.heading-modal__header p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0;
		text-transform: uppercase;
	}
	.heading-modal__header h2 {
		margin: 0.1rem 0 0;
		color: hsl(var(--foreground));
		font-size: 1.2rem;
		font-weight: 950;
		line-height: 1.1;
	}
	.heading-modal__actions {
		display: flex;
		gap: 0.45rem;
	}
	.heading-modal__ghost {
		padding: 0.48rem 0.7rem;
	}
	.heading-modal__save {
		background: var(--pixel-magenta) !important;
		color: hsl(var(--primary-foreground)) !important;
		padding: 0.55rem 0.85rem;
	}
	.heading-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(9rem, 14rem);
		gap: 0.65rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.9 0.04 82);
		padding: 0.7rem 0.85rem;
	}
	.heading-fields label {
		display: grid;
		gap: 0.25rem;
	}
	.heading-fields span {
		color: hsl(var(--muted-foreground));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.heading-fields input,
	.heading-fields select {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.45rem 0.55rem;
		color: hsl(var(--foreground));
		font-size: 0.88rem;
	}
	.heading-inspector__open:focus-visible,
	.heading-modal button:focus-visible,
	.heading-fields input:focus-visible,
	.heading-fields select:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
	@media (max-width: 700px) {
		.heading-modal {
			padding: 0;
		}
		.heading-modal__panel {
			width: 100%;
			height: 100dvh;
			max-height: 100dvh;
			box-shadow: none;
		}
		.heading-modal__header {
			align-items: stretch;
			flex-direction: column;
		}
		.heading-fields {
			grid-template-columns: 1fr;
		}
	}
</style>
