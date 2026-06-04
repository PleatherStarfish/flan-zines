<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusLabel: Record<string, string> = {
		draft: 'Draft',
		in_review: 'In review',
		published: 'Published',
		unlisted: 'Unlisted'
	};

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>My zines — Zine studio</title>
</svelte:head>

<div class="flex items-center justify-between">
	<h1 class="text-2xl font-bold tracking-tight text-foreground">My zines</h1>
	<!-- Creating/editing zines arrives with the editor in Step 3. -->
	<button
		type="button"
		disabled
		title="The editor arrives in Step 3"
		class="cursor-not-allowed rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background opacity-50"
	>
		New zine
	</button>
</div>

{#if data.zines.length === 0}
	<p class="mt-10 text-muted-foreground" data-testid="zines-empty">
		You haven’t started a zine yet. The editor opens up in Step 3 — your work will appear here.
	</p>
{:else}
	<ul class="mt-8 divide-y divide-border rounded-md border border-border" data-testid="zines-list">
		{#each data.zines as zine (zine.id)}
			<li class="flex items-center justify-between px-4 py-3">
				<div>
					<p class="font-medium text-foreground">{zine.title}</p>
					<p class="text-xs text-muted-foreground">Updated {formatDate(zine.updated_at)}</p>
				</div>
				<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
					{statusLabel[zine.status] ?? zine.status}
				</span>
			</li>
		{/each}
	</ul>
{/if}
