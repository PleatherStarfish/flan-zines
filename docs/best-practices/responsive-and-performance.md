# Responsive & performance — implementation best practices

**Audience: AI implementing anything that runs on a school Chromebook or phone.** Governs the C4
performance budget, mobile fallbacks, resize handling, and scroll-perf. Sources: **[RESPONSIVE]**,
**[RESIZE]**, **[SCROLLAMA]**, **[SIX-LIBS]**. Pair with [scrollytelling.md](scrollytelling.md).

---

## TL;DR (the rules)

1. **MUST NOT size scroll steps/graphics with `vh`.** Compute px from `window.innerHeight` on
   load/resize. Mobile navbars resize the viewport and make `vh` triggers jump. **[RESPONSIVE]**,
   **[RESIZE]**
2. **MUST handle resize.** ~2–3% of users resize; structure code as **`setup()` / `resize()` /
   `draw()`** and debounce. **[RESIZE]**
3. **MUST prefer `IntersectionObserver`** over scroll listeners; if you must listen to scroll, throttle
   - `requestAnimationFrame`. **[SCROLLAMA]**, **[SIX-LIBS]**
4. **MUST animate transform/opacity only**; never animate layout properties on scroll. (Perf budget.)
5. **SHOULD plan mobile first**, and **stack instead of scroll** when scrolly motion would be heavy,
   redundant, or unsupported. **[RESPONSIVE]**
6. **SHOULD switch JS behavior with `matchMedia`**, kept in sync with CSS breakpoints. **[RESPONSIVE]**
7. **MUST code-split heavy libs** (GSAP, Three.js/Threlte, D3); they MUST be absent from a text-only
   zine's base bundle. (C4.)

---

## 1. The performance budget (what "good" means)

From [REQUIREMENTS.md §B](../../REQUIREMENTS.md): a sample text zine base JS **< 100 KB gz**; **LCP <
2.5 s** on a mid-tier Chromebook; per-preset FPS caps. The rules below are how you stay inside it.
Published pages are static/ISR + CDN with **no per-request DB calls** — never add a server round-trip to
the public read path.

---

## 2. Plan mobile first; decide scroll-vs-stack deliberately

**Rule:** Decide a story's mobile form _up front_, and choose between **keep-it-scrolly** and **stack
it** (a series of standalone static charts/images). — **Why:** **[RESPONSIVE]** — mobile-first "forces
you to pare down … leaving only the necessities," and desktop becomes the enhanced version. — **Pattern
(decision table):**

| Stack it (static steps) when…                                  | Keep it scrolly when…                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| Animations/transitions would hurt performance **[RESPONSIVE]** | The transition **is** the meaning (change over time, movement) |
| Steps read fine as standalone charts                           | Spatial/temporal continuity matters                            |
| A different chart type fits mobile better                      | The sticky pattern is core to comprehension                    |
| You're on a deadline / low-power target                        | You have the perf headroom (measured, not assumed)             |

**Maps to flan-zines:** "stack it" is the mobile/low-power and reduced-motion fallback for
`sticky-steps` and `pin-horizontal`. The renderer SHOULD collapse to stacked, static steps when
`matchMedia` reports a narrow/coarse pointer device or reduced motion is set. — **Avoid:** the two
patterns **[RESPONSIVE]** explicitly rejects — **steppers** (force click-to-advance) and **swipe/tap**
that override scrolling. Neither belongs in our preset palette.

---

## 3. Never use `vh` for scroll sizing — the mobile-navbar trap

**Rule:** For any height that drives a scroll trigger or a full-screen step, MUST use px derived from
`window.innerHeight`, recomputed on load/resize. MUST NOT use `vh`. — **Why:** **[RESPONSIVE]** — "Mobile
browsers toggle the top and bottom navbars … This causes the viewport height to change, and will mess
with your scroll triggers and make things a little janky." **[RESIZE]** confirms mobile scroll toggles
navbar visibility and fires resize. — **Pattern (our stack):**

```svelte
<script lang="ts">
	let stepHeightPx = $state(0);
	function measure() {
		stepHeightPx = Math.floor(window.innerHeight * 0.75); // breathing room between steps
	}
	$effect(() => {
		measure();
		const onResize = debounce(measure, 150);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<div class="step" style:height="{stepHeightPx}px">…</div>
```

**Gotcha:** `100vh` is fine for non-scroll, non-trigger decorative full-bleed where a little jump is
invisible — but if it gates a Scrollama trigger or a sticky range, it WILL desync. Default to px.

---

## 4. Structure: `setup()` / `resize()` / `draw()` — rebuild nothing

**Rule:** Separate one-time **setup** (create elements, bind data) from **resize** (recompute
dimensions/scales) from **draw** (update positions/sizes). On resize, **update**, never rebuild. —
**Why:** **[RESIZE]** and **[RESPONSIVE]** — "Separate all your chart setup and chart drawing
functionality … on resize, you can simply update your charts rather than build them from scratch." It's
also required for a responsive graphic to stay smooth. — **Pattern (the canonical init, [RESIZE]):**

```ts
function setup() {
	/* create DOM/canvas, bind data — once */
}
function resize() {
	/* read new dimensions, update scales, reposition — cheap, idempotent */
}
function init() {
	setup();
	resize();
	window.addEventListener('resize', debounce(resize, 150)); // [RESIZE]: debounce ~150ms
}
```

In Svelte, express this as: data/DOM in markup + an `onMount`-style `setup`, a `$effect` that runs
`resize` and subscribes a **debounced** `ResizeObserver`/`resize` listener, and `draw` as `$derived`
state the template reads. — **Gotcha:** an undebounced resize handler fires dozens of times per drag and
tanks FPS. Always debounce (~150ms) **[RESIZE]**; for continuous scroll work use rAF (§6).

---

## 5. ~2–3% of users resize — and you must care

**Rule:** Treat resize as a first-class case, not a dev-only edge. — **Why:** **[RESIZE]** measured
**2.0% mobile, 2.3% desktop** of sessions resize (mobile resize ≈ orientation change). "If you get 50k
people to look at your work, that means 1,000 are going to resize the browser, and see something
potentially broken." On a school deployment with shared/rotated devices, orientation changes are
common. — **Pattern:** compare **width** on a debounced resize (height alone changes from mobile navbar
toggling and usually shouldn't rebuild a graphic) — **except** for genuinely full-height scrolly
sections, which do need the recomputed height. **[RESIZE]**

---

## 6. IntersectionObserver over scroll listeners; throttle + rAF if you must

**Rule:** Detect in-view with `IntersectionObserver`. If a bespoke effect genuinely needs scroll
position, throttle the handler and read/write inside `requestAnimationFrame`. — **Why:** **[SCROLLAMA]**
— scroll events cause "scroll jank"; **[SIX-LIBS]**'s roll-your-own warns you "want to consider
performance optimizations like throttling." — **Pattern:** Scrollama for steps; GSAP ScrollTrigger
(which uses a single optimized listener + rAF internally) for scrubbed motion. Do not add your own
parallel `scroll` listener on top.

---

## 7. `matchMedia` for JS/CSS breakpoint sync; sparing device sniffing

**Rule:** When JS must branch on screen size, use `window.matchMedia` evaluated on load/resize, with
the **same breakpoint** as the CSS. — **Why:** **[RESPONSIVE]** — responsive scrollytelling spans CSS
_and_ JS; keep them in sync. — **Pattern:**

```ts
const ENHANCED = '(min-width: 800px)';
const isEnhanced = window.matchMedia(ENHANCED).matches; // re-read on resize
```

For true device capabilities (touch, etc.), a light `is-mobile` class on `<html>` is acceptable as a
CSS hook **[RESPONSIVE]**, but prefer size/feature checks. — **Gotcha:** don't scatter raw
`innerWidth` comparisons; centralize the breakpoint so CSS and JS can't drift.

---

## 8. Touch & pointer: don't trap the scroller

**Rule:** On touch, MUST NOT attach meaning to hover, and MUST make interactions explicit UI targets. —
**Why:** **[RESPONSIVE]** — "inadvertent interactions may happen while the user is simply trying to
scroll"; the fix is to "remove [hover events] and replace with some fixed text or annotation." — **Maps
to flan-zines:** dataViz/interactive presets MUST provide a non-hover, always-visible reading of their
key values (label/annotation), and any tap interaction must be on a clear control, never the whole
scroll surface.

---

## 9. Mount near-viewport, unmount off-screen, cap the work

**Rule:** Heavy effects (WebGL flocking, particle fields, dense charts) MUST mount only when near the
viewport and MUST tear down when off-screen; particle counts/FPS MUST be capped per preset and reduced
on low-power devices. — **Why:** this is the Chromebook budget; an always-running WebGL canvas off-screen
is wasted battery and frames. — **Pattern:** IntersectionObserver to mount/unmount; cap counts in the
preset's params schema; halve density when `matchMedia('(max-width: 800px)')` or a low-power heuristic
matches. (Ties to [data-viz-and-charts.md](data-viz-and-charts.md) §6 on Canvas/WebGL.)

---

## Implementation checklist (anything scroll- or size-driven)

- [ ] No `vh` on scroll-triggering or sticky-range heights; px from `window.innerHeight`, recomputed on
      resize.
- [ ] `setup` / `resize` / `draw` separated; resize **updates**, never rebuilds; resize listener
      **debounced** (~150ms).
- [ ] In-view via IntersectionObserver/Scrollama; any scroll math throttled + rAF; no duplicate scroll
      listeners.
- [ ] Transform/opacity-only animation.
- [ ] Heavy libs dynamically imported; verified absent from the base chunk (bundle-split assertion).
- [ ] `matchMedia` branch shares the CSS breakpoint; mobile collapses scrolly → stacked where heavy.
- [ ] Hover carries no required meaning on touch; interactions are explicit controls.
- [ ] Off-screen heavy canvases unmount; counts/FPS capped and reduced on small/low-power screens.
- [ ] Public read path stays static/ISR — no per-request server work added.

---

## Sources

- **[RESPONSIVE]** Responsive scrollytelling best practices — Russell Samora
- **[RESIZE]** How Many Users Resize Their Browser? — Russell Samora
- **[SCROLLAMA]** An Introduction to Scrollama.js — Russell Samora
- **[SIX-LIBS]** How to implement scrollytelling with six different libraries — Russell Samora
