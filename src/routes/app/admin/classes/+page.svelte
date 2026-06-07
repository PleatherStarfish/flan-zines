<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Classes — Admin</title></svelte:head>

{#if form?.message}<p class="banner">{form.message}</p>{/if}

{#if data.classes.length === 0}
	<p class="empty">No classes yet (or the database isn’t connected).</p>
{:else}
	<ul class="classes">
		{#each data.classes as klass (klass.id)}
			<li class="klass">
				<div>
					<span class="klass__name">{klass.name}</span>
					<span class="klass__meta">
						{klass.teacherName} · {klass.memberCount}
						{klass.memberCount === 1 ? 'student' : 'students'} · code {klass.joinCode}
					</span>
				</div>
				<form
					method="POST"
					action="?/deleteClass"
					use:enhance
					onsubmit={(e) => {
						if (!confirm(`Delete “${klass.name}”? This removes the class and its roster.`))
							e.preventDefault();
					}}
				>
					<input type="hidden" name="id" value={klass.id} />
					<button type="submit" class="danger">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.banner {
		margin: 0 0 0.6rem;
		border: 2px solid var(--pixel-red);
		border-radius: var(--pixel-radius, 0.4rem);
		padding: 0.5rem 0.7rem;
		font-weight: 700;
		color: var(--pixel-red);
	}
	.empty {
		color: hsl(var(--muted-foreground));
	}
	.classes {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.klass {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background:
			linear-gradient(var(--pixel-ink), var(--pixel-ink)) 0 0 / 100% 0.22rem no-repeat,
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px),
			hsl(var(--background));
		background-size:
			100% 0.22rem,
			12px 12px,
			auto;
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.55rem 0.75rem;
	}
	.klass__name {
		font-weight: 800;
		color: var(--pixel-ink, hsl(var(--foreground)));
	}
	.klass__meta {
		display: block;
		font-family: var(--pixel-font-ui);
		font-size: 0.76rem;
		color: hsl(var(--muted-foreground));
	}
	.danger {
		border: 2px solid var(--pixel-red);
		border-radius: var(--pixel-radius, 0.35rem);
		background: hsl(var(--background));
		padding: 0.32rem 0.6rem;
		font-family: var(--pixel-font-ui);
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--pixel-red);
		box-shadow: var(--pixel-shadow-xs);
		cursor: pointer;
	}
</style>
