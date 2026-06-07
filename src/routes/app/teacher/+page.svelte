<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creatingClass = $state(false);
	const hasClasses = $derived(data.classes.length > 0);

	$effect(() => {
		if (!hasClasses) creatingClass = true;
	});

	const statusLabel: Record<string, string> = {
		draft: 'Draft',
		in_review: 'In review',
		published: 'Published',
		unlisted: 'Unlisted'
	};
</script>

<svelte:head><title>Classroom — Zine studio</title></svelte:head>

<section class="classroom">
	<header class="classroom__head">
		<h1>Classroom</h1>
		<p>Your classes, your students’ work, and anything that needs a look.</p>
		<button
			type="button"
			class="pixel-button classroom__new"
			onclick={() => (creatingClass = !creatingClass)}
		>
			{creatingClass ? 'Hide class form' : 'New class'}
		</button>
	</header>

	{#if form?.message}<p role="alert" class="banner">{form.message}</p>{/if}
	{#if form?.ok}<p role="status" class="banner banner--ok">Saved.</p>{/if}

	{#if creatingClass}
		<form method="POST" action="?/createClass" use:enhance class="class-form">
			<label>
				<span>Class name</span>
				<input
					name="name"
					type="text"
					class="pixel-input"
					placeholder="Period 3 Field Zines"
					maxlength="80"
					required
				/>
			</label>
			<button type="submit" class="pixel-button pixel-button--primary">Create class</button>
		</form>
	{/if}

	{#if data.reports.length > 0}
		<section class="reports">
			<h2>Reports to review <span class="count">{data.reports.length}</span></h2>
			<ul class="queue">
				{#each data.reports as report (report.id)}
					<li class="item">
						<p class="item__reason">{report.reason}</p>
						<form method="POST" action="?/resolveReport" use:enhance class="item__actions">
							<input type="hidden" name="id" value={report.id} />
							<button name="status" value="resolved" type="submit">Resolve</button>
							<button name="status" value="dismissed" type="submit" class="ghost">Dismiss</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.classes.length === 0}
		<p class="empty">
			You don’t have any classes yet (or the database isn’t connected). Once students join a class,
			their work shows up here.
		</p>
	{:else}
		{#each data.classes as klass (klass.id)}
			<section class="class">
				<div class="class__head">
					<div>
						<h2>{klass.name} <span class="count">{klass.students.length}</span></h2>
						<p class="join-code">Join code <strong>{klass.joinCode}</strong></p>
					</div>
				</div>
				{#if klass.students.length === 0}
					<p class="empty">No students in this class yet. Share the join code above.</p>
				{:else}
					<ul class="roster">
						{#each klass.students as student (student.id)}
							<li class="student">
								<div class="student__head">
									<span class="student__name">{student.name}</span>
									{#if student.pendingAssets.length > 0}
										<span class="pill">{student.pendingAssets.length} to review</span>
									{/if}
								</div>

								{#if student.zines.length > 0}
									<ul class="zines">
										{#each student.zines as zine (zine.id)}
											<li>
												<a href={`/app/zines/${zine.id}/edit`}>{zine.title}</a>
												<span class="zines__status">{statusLabel[zine.status] ?? zine.status}</span>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="muted">No zines yet.</p>
								{/if}

								{#each student.pendingAssets as asset (asset.id)}
									<div class="asset">
										<span class="asset__label">{asset.kind}: {asset.alt || 'no description'}</span>
										<form method="POST" action="?/moderateAsset" use:enhance class="item__actions">
											<input type="hidden" name="id" value={asset.id} />
											<button name="status" value="approved" type="submit">Approve</button>
											<button name="status" value="rejected" type="submit" class="ghost"
												>Reject</button
											>
										</form>
									</div>
								{/each}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}
</section>

<style>
	.classroom {
		display: grid;
		gap: 1.1rem;
	}
	.classroom__head {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.06) 1px, transparent 1px),
			oklch(0.94 0.032 83 / 0.92);
		background-size: 12px 12px;
		box-shadow: var(--pixel-shadow-sm);
		padding: 1rem;
	}
	.classroom__head h1 {
		margin: 0;
		font-family: var(--pixel-font-ui);
		font-size: 1.4rem;
		font-weight: 950;
		text-shadow: 0.08rem 0.08rem 0 var(--pixel-yellow);
	}
	.classroom__head p {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		color: hsl(var(--muted-foreground));
	}
	.classroom__new {
		padding: 0.45rem 0.8rem;
	}
	.banner {
		margin: 0;
		border: 2px solid var(--pixel-red);
		border-radius: var(--pixel-radius, 0.4rem);
		background:
			linear-gradient(90deg, oklch(0.56 0.18 28 / 0.1) 1px, transparent 1px), oklch(0.97 0.02 82);
		background-size: 10px 10px;
		padding: 0.5rem 0.7rem;
		font-weight: 700;
		color: var(--pixel-red);
	}
	.banner--ok {
		border-color: var(--pixel-green);
		color: oklch(0.34 0.12 151);
	}
	.class-form {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) auto;
		align-items: end;
		gap: 0.65rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.5rem);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px),
			hsl(var(--background));
		background-size: 12px 12px;
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.85rem 1rem;
	}
	.class-form label {
		display: grid;
		gap: 0.3rem;
	}
	.class-form span {
		font-size: 0.82rem;
		font-weight: 850;
	}
	.class-form input {
		width: 100%;
		padding: 0.55rem 0.7rem;
	}
	.class-form button {
		padding: 0.52rem 0.8rem;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem;
		font-family: var(--pixel-font-ui);
		font-size: 1.05rem;
		font-weight: 900;
	}
	.count {
		border: 1px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-yellow, hsl(var(--muted)));
		padding: 0 0.5rem;
		font-size: 0.76rem;
	}
	.empty,
	.muted {
		color: hsl(var(--muted-foreground));
		font-size: 0.88rem;
	}
	.class,
	.reports {
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
		box-shadow: var(--pixel-shadow-sm);
		padding: 0.85rem 1rem;
	}
	.class__head {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.join-code {
		margin: -0.2rem 0 0.7rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.78rem;
		font-weight: 750;
	}
	.join-code strong {
		color: hsl(var(--foreground));
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		letter-spacing: 0;
	}
	.roster,
	.queue,
	.zines {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.roster {
		display: grid;
		gap: 0.6rem;
	}
	.student {
		display: grid;
		gap: 0.35rem;
		border-top: 1px dashed hsl(var(--border));
		padding-top: 0.6rem;
	}
	.student:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.student__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.student__name {
		font-weight: 850;
	}
	.pill {
		border: 1px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-yellow);
		padding: 0 0.5rem;
		font-family: var(--pixel-font-ui);
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--pixel-ink);
	}
	.zines {
		display: grid;
		gap: 0.2rem;
	}
	.zines li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.88rem;
	}
	.zines__status {
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	.asset {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		border: 1px dashed var(--pixel-ink);
		border-radius: var(--pixel-radius, 0.4rem);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.05) 1px, transparent 1px),
			hsl(var(--muted) / 0.45);
		background-size: 10px 10px;
		padding: 0.4rem 0.6rem;
	}
	.asset__label {
		font-size: 0.84rem;
		font-weight: 700;
	}
	.item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background: oklch(0.97 0.02 82);
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.5rem 0.65rem;
	}
	.item__reason {
		margin: 0;
		font-size: 0.86rem;
		font-weight: 700;
	}
	.item__actions {
		display: flex;
		gap: 0.35rem;
	}
	.item__actions button {
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.35rem);
		background: var(--pixel-yellow, hsl(var(--muted)));
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.3rem 0.6rem;
		font-family: var(--pixel-font-ui);
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
	}
	.item__actions button.ghost {
		background: hsl(var(--background));
	}
	@media (max-width: 680px) {
		.class-form {
			grid-template-columns: 1fr;
		}
		.class-form button {
			justify-self: start;
		}
	}
</style>
