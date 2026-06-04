<svelte:head>
	<title>Zine — student visual essays</title>
	<meta name="description" content="A public gallery of student-made scrollytelling zines." />
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-16">
	<div class="flex items-start justify-between gap-4">
		<h1 class="text-4xl font-bold tracking-tight text-foreground">Zine</h1>
		<a
			href="/login"
			class="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
		>
			Sign in
		</a>
	</div>
	<p class="mt-3 text-muted-foreground">
		A digital zine-making tool for student writers. The public gallery lands here in Step 5.
	</p>

	<section aria-labelledby="gallery-heading" class="mt-10">
		<h2 id="gallery-heading" class="text-lg font-semibold text-foreground">Published zines</h2>
		<p class="mt-2 text-sm text-muted-foreground" data-testid="gallery-empty">
			No zines published yet.
		</p>
		<p class="mt-4 text-sm">
			<a
				href="/z/riverwild/why-we-read-at-night"
				class="font-medium text-foreground underline underline-offset-2 hover:text-primary"
				data-testid="sample-zine-link"
			>
				Preview a sample zine →
			</a>
		</p>
	</section>
</main>
