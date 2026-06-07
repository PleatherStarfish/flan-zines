<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cards = $derived([
		{ label: 'People', value: data.counts.users, href: '/app/admin/users' },
		{ label: 'Classes', value: data.counts.classes, href: '/app/admin/classes' },
		{ label: 'Zines', value: data.counts.zines, href: null },
		{ label: 'Open reports', value: data.counts.reports, href: '/app/admin/safety', alert: true },
		{
			label: 'Awaiting moderation',
			value: data.counts.moderation,
			href: '/app/admin/safety',
			alert: true
		}
	]);
</script>

<svelte:head><title>Admin — Zine studio</title></svelte:head>

<div class="cards">
	{#each cards as card (card.label)}
		<svelte:element
			this={card.href ? 'a' : 'div'}
			href={card.href ?? undefined}
			class="card"
			class:card--alert={card.alert && card.value > 0}
			class:card--link={card.href}
		>
			<span class="card__value">{card.value}</span>
			<span class="card__label">{card.label}</span>
		</svelte:element>
	{/each}
</div>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.7rem;
	}
	.card {
		display: grid;
		gap: 0.2rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.5rem);
		background:
			linear-gradient(var(--pixel-ink), var(--pixel-ink)) 0 0 / 100% 0.28rem no-repeat,
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px),
			hsl(var(--background));
		background-size:
			100% 0.28rem,
			12px 12px,
			auto;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: var(--pixel-ink, hsl(var(--foreground)));
		box-shadow: var(--pixel-shadow-sm);
	}
	.card--link:hover {
		background:
			linear-gradient(var(--pixel-ink), var(--pixel-ink)) 0 0 / 100% 0.28rem no-repeat,
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.07) 1px, transparent 1px),
			var(--pixel-yellow, hsl(var(--muted)));
		background-size:
			100% 0.28rem,
			12px 12px,
			auto;
		transform: translate(-2px, -2px);
	}
	.card--alert {
		border-color: var(--pixel-red);
		box-shadow: 0.22rem 0.22rem 0 var(--pixel-red);
	}
	.card__value {
		font-family: var(--pixel-font-ui);
		font-size: 1.8rem;
		font-weight: 950;
		font-variant-numeric: tabular-nums;
	}
	.card__label {
		font-family: var(--pixel-font-ui);
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0;
		color: hsl(var(--muted-foreground));
	}
</style>
