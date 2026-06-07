<script lang="ts">
	import { contrastRatio, meetsAA } from '$lib/zine/theme/derive';

	// A live WCAG contrast indicator for a foreground colour on the theme background. Green
	// "AA" when it passes, amber "Low" otherwise — the editor WARNS, it never blocks (older
	// students keep full creative control; the schema still sanitises every value).
	let { fg, bg, large = false }: { fg: string; bg: string; large?: boolean } = $props();

	const ratio = $derived(contrastRatio(fg, bg));
	const ok = $derived(meetsAA(fg, bg, large));
</script>

<span
	class="badge {ok ? 'ok' : 'warn'}"
	title="Contrast {Number.isFinite(ratio) ? ratio.toFixed(1) : '–'}:1 against the background"
>
	{ok ? 'AA' : 'Low'}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		border-radius: 0.3rem;
		padding: 0.05rem 0.35rem;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0;
		text-transform: uppercase;
	}
	.ok {
		background: #dcfce7;
		color: #166534;
	}
	.warn {
		background: #fef3c7;
		color: #92400e;
	}
</style>
