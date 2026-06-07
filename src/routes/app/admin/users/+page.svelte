<script lang="ts">
	import { enhance } from '$app/forms';
	import type { AppRole } from '$lib/supabase/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const roles: AppRole[] = ['student', 'teacher', 'admin'];
</script>

<svelte:head><title>People — Admin</title></svelte:head>

{#if form?.message}<p class="banner banner--error">{form.message}</p>{/if}
{#if form?.ok}<p class="banner banner--ok">Role updated.</p>{/if}

{#if data.users.length === 0}
	<p class="empty">No people yet (or the database isn’t connected).</p>
{:else}
	<ul class="people">
		{#each data.users as person (person.id)}
			<li class="person">
				<div class="person__identity">
					<span class="person__name">{person.display_name ?? 'Unnamed'}</span>
					<span class="person__meta">Current role: {person.role}</span>
				</div>
				<form method="POST" action="?/setRole" use:enhance class="person__role">
					<input type="hidden" name="userId" value={person.id} />
					<label class="sr-only" for={`role-${person.id}`}
						>Role for {person.display_name ?? 'unnamed person'}</label
					>
					<select id={`role-${person.id}`} name="role" value={person.role}>
						{#each roles as role (role)}
							<option value={role}>{role}</option>
						{/each}
					</select>
					<button type="submit">Save</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.banner {
		margin: 0 0 0.6rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		padding: 0.5rem 0.7rem;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.banner--error {
		border-color: var(--pixel-red);
		color: var(--pixel-red);
	}
	.banner--ok {
		border-color: var(--pixel-green);
		color: oklch(0.34 0.12 151);
	}
	.empty {
		color: hsl(var(--muted-foreground));
	}
	.people {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.person {
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
		padding: 0.5rem 0.75rem;
	}
	.person__identity {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.person__name {
		font-weight: 800;
		color: var(--pixel-ink, hsl(var(--foreground)));
	}
	.person__meta {
		color: hsl(var(--muted-foreground));
		font-family: var(--pixel-font-ui);
		font-size: 0.74rem;
		font-weight: 750;
		text-transform: capitalize;
	}
	.person__role {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.35rem;
	}
	.person__role select,
	.person__role button {
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.35rem);
		background: hsl(var(--background));
		padding: 0.3rem 0.5rem;
		font-family: var(--pixel-font-ui);
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.person__role button {
		background: var(--pixel-yellow, hsl(var(--muted)));
		box-shadow: var(--pixel-shadow-xs);
		cursor: pointer;
		text-transform: none;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
</style>
