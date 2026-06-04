<script lang="ts">
	import type { LinkButtonProps } from './schema';

	let { props }: { props: LinkButtonProps } = $props();
</script>

<a
	href={props.href}
	class={props.variant === 'button' ? 'zine-button' : 'zine-link'}
	target={props.newTab ? '_blank' : undefined}
	rel={props.newTab ? 'noopener noreferrer' : undefined}>{props.label}</a
>
