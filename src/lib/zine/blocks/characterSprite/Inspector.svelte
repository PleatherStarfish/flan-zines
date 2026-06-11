<script lang="ts">
	import type { CharacterSpriteProps, ExportSize, SpriteAction } from './schema';
	import {
		CHARACTER_ACTION_LABELS,
		CHARACTER_SIZE_LABELS,
		EXPORT_SIZES,
		SPRITE_ACTIONS
	} from './schema';

	let {
		value,
		onChange
	}: { value: CharacterSpriteProps; onChange: (next: CharacterSpriteProps) => void } = $props();

	const inputClass =
		'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
	const altMissing = $derived(value.alt.trim().length === 0);

	function updateSource(partial: Partial<CharacterSpriteProps['source']>): void {
		onChange({ ...value, source: { ...value.source, ...partial } });
	}
</script>

<div class="character-inspector">
	<label class="block">
		<span>Action</span>
		<select
			value={value.action}
			onchange={(e) => onChange({ ...value, action: e.currentTarget.value as SpriteAction })}
			class={inputClass}
		>
			{#each SPRITE_ACTIONS as action (action)}
				<option value={action}>{CHARACTER_ACTION_LABELS[action]}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span>Size</span>
		<select
			value={value.size}
			onchange={(e) => onChange({ ...value, size: e.currentTarget.value as ExportSize })}
			class={inputClass}
		>
			{#each EXPORT_SIZES as size (size)}
				<option value={size}>{CHARACTER_SIZE_LABELS[size]}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span>GIF URL</span>
		<input
			type="url"
			value={value.source.src ?? ''}
			placeholder="https://... or /character.gif"
			oninput={(e) => updateSource({ src: e.currentTarget.value || undefined })}
			class={inputClass}
		/>
	</label>

	<label class="block">
		<span>Still image URL</span>
		<input
			type="url"
			value={value.source.poster ?? ''}
			placeholder="https://... or /character-still.png"
			oninput={(e) => updateSource({ poster: e.currentTarget.value || undefined })}
			class={inputClass}
		/>
		<small>Shown when a reader uses reduced motion.</small>
	</label>

	<label class="block">
		<span>Alt text <em>(required to publish)</em></span>
		<input
			type="text"
			value={value.alt}
			placeholder="Describe the character and what they are doing"
			oninput={(e) => onChange({ ...value, alt: e.currentTarget.value })}
			class={inputClass}
		/>
		<small class:warn={altMissing}>
			{altMissing ? 'Add a short description before publishing.' : 'Clear description saved.'}
		</small>
	</label>
</div>

<style>
	.character-inspector {
		display: grid;
		gap: 0.8rem;
	}

	label {
		display: block;
	}

	span {
		display: block;
		font-size: 0.84rem;
		font-weight: 850;
	}

	em {
		color: hsl(var(--muted-foreground));
		font-style: normal;
		font-weight: 650;
	}

	small {
		display: block;
		margin-top: 0.25rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		line-height: 1.35;
	}

	.warn {
		color: oklch(0.46 0.14 54);
	}
</style>
