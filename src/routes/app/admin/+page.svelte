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
		background: hsl(var(--background));
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: var(--pixel-ink, hsl(var(--foreground)));
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink, transparent);
	}
	.card--link:hover {
		background: var(--pixel-yellow, hsl(var(--muted)));
	}
	.card--alert {
		border-color: #b91c1c;
		box-shadow: 0.12rem 0.12rem 0 #b91c1c;
	}
	.card__value {
		font-size: 1.8rem;
		font-weight: 950;
		font-variant-numeric: tabular-nums;
	}
	.card__label {
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: hsl(var(--muted-foreground));
	}
</style>
