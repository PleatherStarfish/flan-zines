<script lang="ts">
	import type { SpacerProps } from './schema';

	let { value, onChange }: { value: SpacerProps; onChange: (next: SpacerProps) => void } = $props();

	const sizes = [
		{ value: 'sm', label: 'Small' },
		{ value: 'md', label: 'Medium' },
		{ value: 'lg', label: 'Large' }
	] as const;
</script>

<label class="block">
	<span class="text-sm font-medium text-foreground">Space size</span>
	<select
		value={value.size}
		onchange={(e) => onChange({ ...value, size: e.currentTarget.value as SpacerProps['size'] })}
		class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
	>
		{#each sizes as size (size.value)}
			<option value={size.value}>{size.label}</option>
		{/each}
	</select>
</label>
