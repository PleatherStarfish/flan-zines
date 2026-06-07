<script lang="ts">
	import { enhance } from '$app/forms';
	import { ZINE_TEMPLATES } from '$lib/editor/templates';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);

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

<section class="zines-dashboard" aria-labelledby="zines-title">
	<div class="zines-dashboard__head">
		<div>
			<p class="pixel-kicker">Studio shelf</p>
			<h1 id="zines-title" class="pixel-title">My zines</h1>
		</div>
		<button
			type="button"
			onclick={() => (creating = !creating)}
			class="pixel-button pixel-button--primary zines-dashboard__new"
		>
			{creating ? 'Cancel' : 'New zine'}
		</button>
	</div>

	{#if creating}
		<form method="POST" action="?/create" use:enhance class="create-zine pixel-panel-soft">
			<label class="create-zine__field">
				<span>Title</span>
				<input name="title" type="text" placeholder="My zine" required class="pixel-input" />
			</label>
			<fieldset>
				<legend>Start from</legend>
				<div class="template-grid">
					{#each ZINE_TEMPLATES as template, i (template.id)}
						<label class="template-choice">
							<input type="radio" name="template" value={template.id} checked={i === 0} />
							<span>
								<span>{template.label}</span>
								<small>{template.description}</small>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
			{#if form?.message}
				<p role="alert" class="create-zine__error">{form.message}</p>
			{/if}
			<button type="submit" class="pixel-button pixel-button--dark create-zine__submit">
				Create &amp; open editor
			</button>
		</form>
	{/if}

	{#if data.zines.length === 0}
		<div class="empty-shelf pixel-panel-soft" data-testid="zines-empty">
			<p>No zines on the shelf yet.</p>
			<button type="button" onclick={() => (creating = true)} class="pixel-button">
				Start one
			</button>
		</div>
	{:else}
		<ul class="zine-list pixel-panel-soft" data-testid="zines-list">
			{#each data.zines as zine (zine.id)}
				<li>
					<a href={`/app/zines/${zine.id}/edit`} class="zine-list__row">
						<div>
							<p>{zine.title}</p>
							<small>Updated {formatDate(zine.updated_at)}</small>
						</div>
						<span class="pixel-badge">
							{statusLabel[zine.status] ?? zine.status}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.zines-dashboard {
		display: grid;
		gap: 1.1rem;
	}
	.zines-dashboard__head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.06) 1px, transparent 1px),
			oklch(0.94 0.032 83 / 0.92);
		background-size: 12px 12px;
		box-shadow: var(--pixel-shadow-sm);
		padding: 1rem;
	}
	.zines-dashboard h1 {
		margin: 0.15rem 0 0;
		font-size: 2.4rem;
		line-height: 1;
	}
	.zines-dashboard__new {
		padding: 0.65rem 1rem;
	}
	.create-zine {
		display: grid;
		gap: 1rem;
		padding: 1rem;
	}
	.create-zine__field {
		display: grid;
		gap: 0.38rem;
	}
	.create-zine__field span,
	.create-zine legend {
		color: hsl(var(--foreground));
		font-size: 0.86rem;
		font-weight: 850;
	}
	.create-zine input[type='text'] {
		width: 100%;
		padding: 0.65rem 0.75rem;
	}
	.template-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
		margin-top: 0.55rem;
	}
	.template-choice {
		display: flex;
		cursor: pointer;
		gap: 0.7rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px),
			oklch(0.97 0.02 82);
		background-size: 10px 10px;
		padding: 0.75rem;
		box-shadow: var(--pixel-shadow-xs);
	}
	.template-choice:has(:checked) {
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.08) 1px, transparent 1px), var(--pixel-green);
		background-size: 10px 10px;
		box-shadow: var(--pixel-shadow-sm);
	}
	.template-choice input {
		margin-top: 0.2rem;
		accent-color: hsl(var(--primary));
	}
	.template-choice span span {
		display: block;
		color: hsl(var(--foreground));
		font-size: 0.9rem;
		font-weight: 850;
	}
	.template-choice small {
		display: block;
		margin-top: 0.18rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.76rem;
		line-height: 1.35;
	}
	.create-zine__error {
		margin: 0;
		color: hsl(var(--destructive));
		font-size: 0.84rem;
		font-weight: 750;
	}
	.create-zine__submit {
		justify-self: start;
		padding: 0.65rem 1rem;
	}
	.empty-shelf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
	}
	.empty-shelf p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-weight: 750;
	}
	.empty-shelf button {
		padding: 0.5rem 0.9rem;
	}
	.zine-list {
		overflow: hidden;
		padding: 0;
		list-style: none;
	}
	.zine-list li + li {
		border-top: 2px solid var(--pixel-ink);
	}
	.zine-list__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		color: inherit;
		text-decoration: none;
		transition:
			transform 120ms steps(2, end),
			background-color 120ms steps(2, end);
	}
	.zine-list__row:hover {
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.08) 1px, transparent 1px),
			oklch(0.82 0.16 86 / 0.42);
		background-size: 10px 10px;
		transform: translate(-2px, -2px);
	}
	.zine-list__row p {
		margin: 0;
		color: hsl(var(--foreground));
		font-weight: 850;
	}
	.zine-list__row small {
		display: block;
		margin-top: 0.15rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.75rem;
	}
	@media (max-width: 720px) {
		.zines-dashboard__head {
			align-items: stretch;
			flex-direction: column;
		}
		.template-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
