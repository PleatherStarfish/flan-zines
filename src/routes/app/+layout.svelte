<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const name = $derived(data.profile?.display_name ?? data.email ?? 'Signed in');
	const role = $derived(data.profile?.role ?? 'student');
</script>

<div class="min-h-screen bg-background">
	<header class="border-b border-border">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<a href="/app" class="font-bold tracking-tight text-foreground">Zine studio</a>
			<div class="flex items-center gap-4">
				<span class="text-sm text-muted-foreground">
					{name}
					<span
						class="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground"
						>{role}</span
					>
				</span>
				<form method="POST" action="/auth/signout">
					<button
						type="submit"
						class="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition hover:bg-muted"
					>
						Sign out
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		{@render children()}
	</main>
</div>
