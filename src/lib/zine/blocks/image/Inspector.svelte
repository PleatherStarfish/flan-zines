<script lang="ts">
	import type { ImageProps } from './schema';

	let { value, onChange }: { value: ImageProps; onChange: (next: ImageProps) => void } = $props();

	const inputClass =
		'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
	const altMissing = $derived(value.alt.trim().length === 0);
</script>

<div class="space-y-3">
	<label class="block">
		<span class="text-sm font-medium text-foreground">Image URL</span>
		<input
			type="url"
			value={value.src}
			placeholder="https://… or /a-file.svg"
			oninput={(e) => onChange({ ...value, src: e.currentTarget.value })}
			class={inputClass}
		/>
	</label>

	<label class="block">
		<span class="text-sm font-medium text-foreground">
			Alt text <span class="text-muted-foreground">(required to publish)</span>
		</span>
		<input
			type="text"
			value={value.alt}
			placeholder="Describe this picture for someone who can’t see it"
			aria-describedby="alt-help"
			oninput={(e) => onChange({ ...value, alt: e.currentTarget.value })}
			class={inputClass}
		/>
		<span
			id="alt-help"
			class="mt-1 block text-xs {altMissing ? 'text-amber-700' : 'text-muted-foreground'}"
		>
			{altMissing
				? 'Add a short description — it’s good writing practice and required before you publish.'
				: 'Nice — a clear description.'}
		</span>
	</label>

	<label class="block">
		<span class="text-sm font-medium text-foreground"
			>Caption <span class="text-muted-foreground">(optional)</span></span
		>
		<input
			type="text"
			value={value.caption ?? ''}
			oninput={(e) => onChange({ ...value, caption: e.currentTarget.value || undefined })}
			class={inputClass}
		/>
	</label>
</div>
