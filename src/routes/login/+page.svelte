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

<main class="pixel-shell login-page">
	<section class="login-card pixel-panel" aria-labelledby="login-title">
		<p class="pixel-kicker">Insert school pass</p>
		<h1 id="login-title" class="pixel-title">Sign in</h1>
		<p class="login-card__intro">Use your school Google account, or get a magic link by email.</p>

		{#if !isSupabaseConfigured}
			<p role="status" class="login-alert login-alert--warning">
				Sign-in isn’t configured in this environment. Set <code>PUBLIC_SUPABASE_URL</code> and
				<code>PUBLIC_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>).
			</p>
		{/if}

		{#if errorParam}
			<p role="alert" class="login-alert login-alert--error">
				We couldn’t complete that sign-in. Please try again.
			</p>
		{/if}

		<button
			type="button"
			onclick={signInWithGoogle}
			disabled={!isSupabaseConfigured || oauthPending}
			class="pixel-button pixel-button--primary login-card__button"
		>
			{oauthPending ? 'Redirecting to Google…' : 'Continue with Google'}
		</button>

		{#if dev}
			<form method="POST" action="?/devlogin" class="login-card__dev">
				<button type="submit" class="pixel-button login-card__button">
					Continue as Riverwild
				</button>
				{#if devLoginMessage}
					<p role="alert" class="login-alert login-alert--error">{devLoginMessage}</p>
				{/if}
				<p>
					Local development only. Uses <code>river@lakeside.test</code>.
				</p>
			</form>
		{/if}

		<div class="login-divider">
			<span></span>
			or
			<span></span>
		</div>

		{#if form && 'success' in form && form.success}
			<p role="status" class="login-alert login-alert--success">
				Check <strong>{form.email}</strong> for a sign-in link.
			</p>
		{:else}
			<form method="POST" action="?/magiclink" use:enhance class="login-card__form">
				<div>
					<label for="email">School email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={form?.email ?? ''}
						aria-describedby={magicLinkMessage ? 'email-error' : undefined}
						class="pixel-input"
					/>
				</div>

				{#if magicLinkMessage}
					<p id="email-error" role="alert" class="login-form-error">{magicLinkMessage}</p>
				{/if}

				<button
					type="submit"
					disabled={!isSupabaseConfigured}
					class="pixel-button pixel-button--dark login-card__button"
				>
					Email me a magic link
				</button>
			</form>
		{/if}

		<p class="login-card__back">
			<a href="/" class="pixel-link">Back to gallery</a>
		</p>
	</section>
</main>

<style>
	.login-page {
		display: grid;
		min-height: 100vh;
		place-items: center;
		padding: 1rem;
	}
	.login-card {
		width: min(100%, 28rem);
		padding: 1.6rem;
	}
	.login-card h1 {
		margin: 0.2rem 0 0;
		font-size: 2.6rem;
		line-height: 1;
	}
	.login-card__intro {
		margin: 0.85rem 0 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.95rem;
		line-height: 1.5;
	}
	.login-card__button {
		margin-top: 1rem;
		width: 100%;
		padding: 0.72rem 1rem;
		text-align: center;
	}
	.login-card__dev {
		margin-top: 0.85rem;
	}
	.login-card__dev p {
		margin: 0.7rem 0 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.76rem;
	}
	.login-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.35rem 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.login-divider span {
		height: 2px;
		flex: 1 1 auto;
		background: var(--pixel-ink);
		opacity: 0.55;
	}
	.login-card__form {
		display: grid;
		gap: 0.85rem;
	}
	.login-card__form label {
		display: block;
		margin-bottom: 0.35rem;
		color: hsl(var(--foreground));
		font-size: 0.86rem;
		font-weight: 850;
	}
	.login-card__form input {
		width: 100%;
		padding: 0.65rem 0.75rem;
	}
	.login-alert {
		margin: 1rem 0 0;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		padding: 0.75rem;
		box-shadow: var(--pixel-shadow-sm);
		font-size: 0.86rem;
		line-height: 1.45;
	}
	.login-alert--warning {
		background: var(--pixel-yellow);
		color: var(--pixel-ink);
	}
	.login-alert--error {
		background: oklch(0.9 0.08 25);
		color: hsl(var(--destructive));
	}
	.login-alert--success {
		background: oklch(0.88 0.1 145);
		color: var(--pixel-ink);
	}
	.login-form-error {
		margin: 0;
		color: hsl(var(--destructive));
		font-size: 0.84rem;
		font-weight: 750;
	}
	.login-card__back {
		margin: 1.4rem 0 0;
		text-align: center;
		font-size: 0.9rem;
	}
</style>
