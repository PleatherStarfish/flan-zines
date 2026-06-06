<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Safety — Admin</title></svelte:head>

{#if form?.message}<p role="alert" class="banner">{form.message}</p>{/if}
{#if form?.ok}<p role="status" class="banner banner--ok">Saved.</p>{/if}

<div class="cols">
	<section>
		<h2>Reports <span class="count">{data.reports.length}</span></h2>
		{#if data.reports.length === 0}
			<p class="empty">Nothing to triage.</p>
		{:else}
			<ul class="queue">
				{#each data.reports as report (report.id)}
					<li class="item">
						<p class="item__reason">{report.reason}</p>
						<span class="item__meta">status: {report.status}</span>
						<div class="item__actions">
							<form method="POST" action="?/resolveReport" use:enhance>
								<input type="hidden" name="id" value={report.id} />
								<button name="status" value="resolved" type="submit">Resolve</button>
								<button name="status" value="dismissed" type="submit" class="ghost">Dismiss</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2>Awaiting moderation <span class="count">{data.items.length}</span></h2>
		{#if data.items.length === 0}
			<p class="empty">No media awaiting review.</p>
		{:else}
			<ul class="queue">
				{#each data.items as item (item.id)}
					<li class="item">
						<p class="item__reason">{item.target_type}: {item.reason ?? '—'}</p>
						<span class="item__meta">target {item.target_id}</span>
						<div class="item__actions">
							<form method="POST" action="?/reviewItem" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<button name="status" value="approved" type="submit">Approve</button>
								<button name="status" value="rejected" type="submit" class="ghost">Reject</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.banner {
		margin: 0 0 0.6rem;
		border: 2px solid #b91c1c;
		border-radius: var(--pixel-radius, 0.4rem);
		padding: 0.5rem 0.7rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #b91c1c;
	}
	.banner--ok {
		border-color: #166534;
		color: #166534;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1.2rem;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.6rem;
		font-size: 1rem;
		font-weight: 900;
	}
	.count {
		border-radius: 999px;
		background: var(--pixel-yellow, hsl(var(--muted)));
		padding: 0 0.5rem;
		font-size: 0.78rem;
	}
	.empty {
		color: hsl(var(--muted-foreground));
	}
	.queue {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: grid;
		gap: 0.3rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background: hsl(var(--background));
		padding: 0.6rem 0.7rem;
	}
	.item__reason {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 700;
	}
	.item__meta {
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	.item__actions form {
		display: flex;
		gap: 0.35rem;
	}
	.item__actions button {
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.35rem);
		background: var(--pixel-yellow, hsl(var(--muted)));
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
	}
	.item__actions button.ghost {
		background: hsl(var(--background));
	}
</style>
