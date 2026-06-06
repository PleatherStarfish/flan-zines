<script lang="ts">
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const name = $derived(data.profile?.display_name ?? data.email ?? 'Signed in');
	const role = $derived(data.profile?.role ?? 'student');
	const isEditorRoute = $derived($page.url.pathname.includes('/edit'));
</script>

<div class="pixel-shell app-shell">
	{#if !isEditorRoute}
		<header class="app-shell__header">
			<div class="app-shell__bar">
				<a href="/app" class="app-shell__brand">Zine studio</a>
				<div class="app-shell__user">
					<span class="app-shell__identity">
						{name}
						<span class="pixel-badge">{role}</span>
					</span>
					<form method="POST" action="/auth/signout">
						<button type="submit" class="pixel-button app-shell__signout"> Sign out </button>
					</form>
				</div>
			</div>
		</header>
	{/if}

	<main class={isEditorRoute ? 'app-shell__editor-main' : 'app-shell__main'}>
		{@render children()}
	</main>
</div>

<style>
	.app-shell__header {
		position: sticky;
		top: 0;
		z-index: 20;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.92 0.035 84 / 0.96);
	}
	.app-shell__bar {
		display: flex;
		max-width: 72rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 auto;
		padding: 0.8rem 1rem;
	}
	.app-shell__brand {
		color: var(--pixel-ink);
		font-size: 1rem;
		font-weight: 950;
		text-decoration: none;
		text-shadow: 0.09rem 0.09rem 0 var(--pixel-yellow);
	}
	.app-shell__user {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: end;
		gap: 0.75rem;
	}
	.app-shell__identity {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: end;
		gap: 0.45rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.86rem;
		font-weight: 750;
	}
	.app-shell__signout {
		padding: 0.42rem 0.7rem;
		font-size: 0.82rem;
	}
	.app-shell__main {
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: 1.1rem;
	}
	.app-shell__editor-main {
		min-height: 100vh;
	}
	@media (max-width: 640px) {
		.app-shell__bar {
			align-items: stretch;
			flex-direction: column;
		}
		.app-shell__user {
			justify-content: space-between;
		}
	}
</style>
