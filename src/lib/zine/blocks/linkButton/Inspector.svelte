<script lang="ts">
	import type { LinkButtonProps } from './schema';

	let { value, onChange }: { value: LinkButtonProps; onChange: (next: LinkButtonProps) => void } =
		$props();

	const inputClass =
		'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
</script>

<div class="space-y-3">
	<label class="block">
		<span class="text-sm font-medium text-foreground">Button text</span>
		<input
			type="text"
			value={value.label}
			oninput={(e) => onChange({ ...value, label: e.currentTarget.value })}
			class={inputClass}
		/>
	</label>
	<label class="block">
		<span class="text-sm font-medium text-foreground">Link (URL)</span>
		<input
			type="url"
			value={value.href}
			placeholder="https://…"
			oninput={(e) => onChange({ ...value, href: e.currentTarget.value })}
			class={inputClass}
		/>
	</label>
	<label class="block">
		<span class="text-sm font-medium text-foreground">Style</span>
		<select
			value={value.variant}
			onchange={(e) =>
				onChange({ ...value, variant: e.currentTarget.value as LinkButtonProps['variant'] })}
			class={inputClass}
		>
			<option value="link">Text link</option>
			<option value="button">Button</option>
		</select>
	</label>
	<label class="flex items-center gap-2">
		<input
			type="checkbox"
			checked={value.newTab}
			onchange={(e) => onChange({ ...value, newTab: e.currentTarget.checked })}
		/>
		<span class="text-sm text-foreground">Open in a new tab</span>
	</label>
</div>
