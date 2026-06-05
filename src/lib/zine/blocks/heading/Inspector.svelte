<script lang="ts">
	import type { HeadingProps } from './schema';

	let { value, onChange }: { value: HeadingProps; onChange: (next: HeadingProps) => void } =
		$props();

	const levels = [
		{ value: 2, label: 'Section heading (H2)' },
		{ value: 3, label: 'Sub-heading (H3)' },
		{ value: 4, label: 'Minor heading (H4)' }
	] as const;
</script>

<div class="space-y-3">
	<label class="block">
		<span class="text-sm font-medium text-foreground">Heading text</span>
		<input
			type="text"
			value={value.text}
			oninput={(e) => onChange({ ...value, text: e.currentTarget.value })}
			class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
		/>
	</label>
	<label class="block">
		<span class="text-sm font-medium text-foreground">Level</span>
		<select
			value={String(value.level)}
			onchange={(e) =>
				onChange({ ...value, level: Number(e.currentTarget.value) as HeadingProps['level'] })}
			class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
		>
			{#each levels as level (level.value)}
				<option value={String(level.value)}>{level.label}</option>
			{/each}
		</select>
	</label>
</div>
