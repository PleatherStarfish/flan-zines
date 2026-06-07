<script lang="ts">
	import GalaxyBackground from '$lib/ui/GalaxyBackground.svelte';
</script>

<svelte:head>
	<title>Zine — student visual essays</title>
	<meta name="description" content="A public gallery of student-made scrollytelling zines." />
</svelte:head>

<main class="pixel-shell gallery-home">
	<GalaxyBackground />
	<div class="gallery-home__panel pixel-panel">
		<div class="gallery-home__top">
			<span class="pixel-badge">Student arcade</span>
			<a href="/login" class="pixel-button gallery-home__login">Sign in</a>
		</div>
		<h1 class="pixel-title">Jiggly Flan</h1>
		<p>An animated zine builder for creative storytelling</p>
		<div class="gallery-home__actions">
			<a
				href="/z/riverwild/hidden-rivers-under-the-city"
				class="pixel-button pixel-button--primary gallery-home__primary"
				data-testid="sample-zine-link"
			>
				Preview sample
			</a>
			<a href="/login" class="pixel-link">Open studio</a>
		</div>
	</div>

	<section aria-labelledby="gallery-heading" class="gallery-home__gallery pixel-panel-soft">
		<div>
			<p class="pixel-kicker">Published zines</p>
			<h2 id="gallery-heading">Gallery shelf</h2>
		</div>
		<p data-testid="gallery-empty">No zines published yet. The sample is ready to play.</p>
	</section>
</main>

<style>
	.gallery-home {
		position: relative;
		isolation: isolate;
		display: grid;
		min-height: 100vh;
		grid-template-columns: minmax(0, 1.1fr) minmax(16rem, 0.7fr);
		align-items: end;
		gap: 1.5rem;
		padding: min(10vw, 5rem);
		/* Deep-space base behind the generative galaxy canvas (also the fallback before paint). */
		background: radial-gradient(120% 90% at 50% 0%, #0c0b22 0%, #070611 55%, #04030c 100%);
		color: hsl(var(--primary-foreground));
	}
	/* The panels are light cards floating in space — keep them above the fixed canvas. */
	.gallery-home__gallery {
		position: relative;
		z-index: 1;
	}
	.gallery-home__panel {
		position: relative;
		z-index: 1;
		padding: clamp(1.4rem, 4vw, 3rem);
	}
	.gallery-home__panel::after {
		content: '';
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		width: 7rem;
		height: 4.2rem;
		background:
			linear-gradient(var(--pixel-ink), var(--pixel-ink)) 0 0 / 100% 0.7rem no-repeat,
			linear-gradient(
					90deg,
					var(--pixel-magenta) 0 33%,
					var(--pixel-green) 33% 66%,
					var(--pixel-cyan) 66%
				)
				0 100% / 100% 2rem no-repeat;
		clip-path: polygon(0 0, 100% 0, 100% 70%, 82% 70%, 82% 100%, 18% 100%, 18% 70%, 0 70%);
		opacity: 0.22;
		pointer-events: none;
	}
	.gallery-home__top,
	.gallery-home__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
	}
	.gallery-home__top {
		justify-content: space-between;
	}
	.gallery-home__login {
		padding: 0.5rem 0.85rem;
		text-decoration: none;
	}
	.gallery-home h1 {
		margin: 1.6rem 0 0;
		font-size: clamp(3rem, 10vw, 7rem);
		line-height: 0.9;
	}
	.gallery-home p {
		max-width: 39rem;
		margin: 1rem 0 0;
		color: hsl(var(--muted-foreground));
		font-size: 1.08rem;
		line-height: 1.55;
	}
	.gallery-home__actions {
		margin-top: 1.5rem;
	}
	.gallery-home__primary {
		padding: 0.68rem 1rem;
		text-decoration: none;
	}
	.gallery-home__gallery {
		padding: 1.2rem;
	}
	.gallery-home__gallery h2 {
		margin: 0.15rem 0 0;
		color: hsl(var(--foreground));
		font-size: 1.35rem;
		font-weight: 900;
	}
	.gallery-home__gallery p:last-child {
		margin-top: 1rem;
		font-size: 0.94rem;
	}
	@media (max-width: 760px) {
		.gallery-home {
			grid-template-columns: 1fr;
			align-items: stretch;
			padding: 1rem;
		}
	}
</style>
