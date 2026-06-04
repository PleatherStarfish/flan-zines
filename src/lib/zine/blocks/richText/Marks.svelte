<script lang="ts">
	import type { RichTextMark } from '../../schema/richtext';
	import Self from './Marks.svelte';

	// Recursively wrap text in its marks (bold → <strong>, italic → <em>, link → <a>).
	// Links always carry rel="noopener noreferrer"; href is pre-validated to a safe
	// scheme by the schema, so there is no script-injection surface.
	let { marks, text }: { marks: RichTextMark[]; text: string } = $props();
	const first = $derived(marks[0]);
	const rest = $derived(marks.slice(1));
</script>

{#if !first}{text}{:else if first.type === 'bold'}<strong><Self marks={rest} {text} /></strong
	>{:else if first.type === 'italic'}<em><Self marks={rest} {text} /></em
	>{:else if first.type === 'link'}<a
		href={first.attrs.href}
		target={first.attrs.target}
		rel="noopener noreferrer"><Self marks={rest} {text} /></a
	>{/if}
