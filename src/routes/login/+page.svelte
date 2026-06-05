<script lang="ts">
	import { dev } from '$app/environment';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { getBrowserClient } from '$lib/supabase/browser';
	import { isSupabaseConfigured } from '$lib/supabase/config';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const errorParam = $derived($page.url.searchParams.get('error'));
	const message = $derived(form && 'message' in form ? form.message : null);
	const devLoginMessage = $derived(form && 'email' in form ? null : message);
	const magicLinkMessage = $derived(form && 'email' in form ? message : null);
	let oauthPending = $state(false);

	async function signInWithGoogle() {
		const client = getBrowserClient();
		if (!client) return;
		oauthPending = true;
		const { error } = await client.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/auth/callback` }
		});
		if (error) oauthPending = false;
	}
</script>

<svelte:head>
	<title>Sign in — Zine</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
	<h1 class="text-3xl font-bold tracking-tight text-foreground">Sign in</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Use your school Google account, or get a magic link by email.
	</p>

	{#if !isSupabaseConfigured}
		<p
			role="status"
			class="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
		>
			Sign-in isn’t configured in this environment. Set <code>PUBLIC_SUPABASE_URL</code> and
			<code>PUBLIC_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>).
		</p>
	{/if}

	{#if errorParam}
		<p role="alert" class="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
			We couldn’t complete that sign-in. Please try again.
		</p>
	{/if}

	<button
		type="button"
		onclick={signInWithGoogle}
		disabled={!isSupabaseConfigured || oauthPending}
		class="mt-8 flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
	>
		{oauthPending ? 'Redirecting to Google…' : 'Continue with Google'}
	</button>

	{#if dev}
		<form method="POST" action="?/devlogin" class="mt-3">
			<button
				type="submit"
				class="w-full rounded-md border border-dashed border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Continue as Riverwild
			</button>
			{#if devLoginMessage}
				<p role="alert" class="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
					{devLoginMessage}
				</p>
			{/if}
			<p class="mt-2 text-xs text-muted-foreground">
				Local development only. Uses <code>river@lakeside.test</code>.
			</p>
		</form>
	{/if}

	<div class="my-6 flex items-center gap-3 text-xs text-muted-foreground">
		<span class="h-px flex-1 bg-border"></span>
		or
		<span class="h-px flex-1 bg-border"></span>
	</div>

	{#if form && 'success' in form && form.success}
		<p role="status" class="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
			Check <strong>{form.email}</strong> for a sign-in link.
		</p>
	{:else}
		<form method="POST" action="?/magiclink" use:enhance class="space-y-3">
			<div>
				<label for="email" class="block text-sm font-medium text-foreground">School email</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
					aria-describedby={magicLinkMessage ? 'email-error' : undefined}
					class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			{#if magicLinkMessage}
				<p id="email-error" role="alert" class="text-sm text-red-700">{magicLinkMessage}</p>
			{/if}

			<button
				type="submit"
				disabled={!isSupabaseConfigured}
				class="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Email me a magic link
			</button>
		</form>
	{/if}

	<p class="mt-8 text-center text-sm">
		<a href="/" class="text-muted-foreground underline hover:text-foreground">← Back to gallery</a>
	</p>
</main>
