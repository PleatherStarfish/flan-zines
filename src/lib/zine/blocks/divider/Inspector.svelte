<script lang="ts">
	import type { DividerProps } from './schema';

	// Divider has no options today; keep the uniform Inspector signature.
	let {
		value: _value,
		onChange: _onChange
	}: { value: DividerProps; onChange: (next: DividerProps) => void } = $props();
</script>

<p class="text-sm text-muted-foreground">
	A horizontal line to separate parts of your zine. No options.
</p>
