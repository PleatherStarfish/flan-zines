<script lang="ts">
	import type { SpacerProps } from './schema';

	let { props }: { props: SpacerProps } = $props();
</script>

<div class="zine-spacer" data-size={props.size} aria-hidden="true"></div>
