<script lang="ts">
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ href: '/app/admin', label: 'Overview' },
		{ href: '/app/admin/users', label: 'People' },
		{ href: '/app/admin/classes', label: 'Classes' },
		{ href: '/app/admin/safety', label: 'Safety' }
	];
	const current = $derived($page.url.pathname);
	const isActive = (href: string) =>
		href === '/app/admin' ? current === href : current.startsWith(href);
</script>

<section class="admin">
	<header class="admin__head">
		<h1>Admin</h1>
		<p>Everything across the studio — people, classes, and the safety queue.</p>
	</header>
	<nav class="admin__tabs" aria-label="Admin sections">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} class="admin__tab" aria-current={isActive(tab.href) ? 'page' : undefined}>
				{tab.label}
			</a>
		{/each}
	</nav>
	{@render children()}
</section>

<style>
	.admin {
		display: grid;
		gap: 1rem;
	}
	.admin__head h1 {
		margin: 0;
		font-family: var(--pixel-font-ui);
		font-size: 1.4rem;
		font-weight: 950;
		color: var(--pixel-ink, hsl(var(--foreground)));
		text-shadow: 0.08rem 0.08rem 0 var(--pixel-yellow);
	}
	.admin__head p {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		color: hsl(var(--muted-foreground));
	}
	.admin__tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.055) 1px, transparent 1px),
			oklch(0.94 0.032 83 / 0.9);
		background-size: 12px 12px;
		box-shadow: var(--pixel-shadow-sm);
		padding: 0.6rem;
	}
	.admin__tab {
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background: hsl(var(--background));
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.35rem 0.7rem;
		font-family: var(--pixel-font-ui);
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--pixel-ink, hsl(var(--foreground)));
		text-decoration: none;
		text-transform: uppercase;
	}
	.admin__tab[aria-current='page'] {
		background: var(--pixel-yellow, hsl(var(--muted)));
	}
</style>
