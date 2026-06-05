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

<div class="flex items-center justify-between">
	<h1 class="text-2xl font-bold tracking-tight text-foreground">My zines</h1>
	<button
		type="button"
		onclick={() => (creating = !creating)}
		class="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
	>
		{creating ? 'Cancel' : 'New zine'}
	</button>
</div>

{#if creating}
	<form
		method="POST"
		action="?/create"
		use:enhance
		class="mt-6 space-y-4 rounded-lg border border-border bg-muted/40 p-5"
	>
		<label class="block">
			<span class="text-sm font-medium text-foreground">Title</span>
			<input
				name="title"
				type="text"
				placeholder="My zine"
				required
				class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</label>
		<fieldset>
			<legend class="text-sm font-medium text-foreground">Start from</legend>
			<div class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each ZINE_TEMPLATES as template, i (template.id)}
					<label
						class="flex cursor-pointer gap-2 rounded-md border border-border bg-background p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted"
					>
						<input
							type="radio"
							name="template"
							value={template.id}
							checked={i === 0}
							class="mt-0.5"
						/>
						<span>
							<span class="font-medium text-foreground">{template.label}</span>
							<span class="block text-xs text-muted-foreground">{template.description}</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
		{#if form?.message}
			<p role="alert" class="text-sm text-red-700">{form.message}</p>
		{/if}
		<button
			type="submit"
			class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
		>
			Create &amp; open editor
		</button>
	</form>
{/if}

{#if data.zines.length === 0}
	<p class="mt-10 text-muted-foreground" data-testid="zines-empty">
		You haven’t started a zine yet. Click <strong>New zine</strong> to begin.
	</p>
{:else}
	<ul class="mt-8 divide-y divide-border rounded-md border border-border" data-testid="zines-list">
		{#each data.zines as zine (zine.id)}
			<li>
				<a
					href={`/app/zines/${zine.id}/edit`}
					class="flex items-center justify-between px-4 py-3 hover:bg-muted"
				>
					<div>
						<p class="font-medium text-foreground">{zine.title}</p>
						<p class="text-xs text-muted-foreground">Updated {formatDate(zine.updated_at)}</p>
					</div>
					<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
						{statusLabel[zine.status] ?? zine.status}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
