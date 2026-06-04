# Scrollytelling — implementation best practices

**Audience: AI implementing the Zine animation system.** Governs the `sticky-steps`,
`pin-horizontal`, and `scroll-zoom` presets and all scroll-driven rendering. Sources: **[SCROLLAMA]**,
**[STICKY]**, **[SIX-LIBS]**, **[RESPONSIVE]**. Read [responsive-and-performance.md](responsive-and-performance.md)
alongside this — every rule here has a mobile/perf corollary there.

---

## TL;DR (the rules, in force order)

1. **MUST monitor scroll, MUST NOT scrolljack.** React to native scroll; never override scroll speed,
   position, or direction. **[SIX-LIBS]**
2. **MUST trigger steps with `IntersectionObserver`** (via Scrollama), not scroll-event listeners.
   **[SCROLLAMA]**
3. **SHOULD make the graphic stick with CSS `position: sticky`**, not JavaScript. **[STICKY]**
4. **MUST keep the document declarative.** The zine document declares _steps and state_, not DOM math.
   The renderer owns all scroll wiring. (Our document/render separation.)
5. **MUST author content in readable source order**, so it degrades to a coherent stacked article when
   sticky/IO/motion are unavailable or disabled. **[STICKY]**, **[RESPONSIVE]**
6. **MUST provide a `prefers-reduced-motion` fallback** for every scroll preset (no pin, no scrub —
   plain stacked steps). (Our a11y invariant.)
7. **SHOULD keep stories short.** A few steps, then exit. Over-long scrollytelling fatigues — worse on
   mobile. **[RESPONSIVE]**

---

## 1. Scrollytelling vs scrolljacking (the bright line)

**Rule:** The graphic MUST change _in response to_ scroll position. The page MUST NOT alter the
browser's native scroll mechanics. — **Why:** **[SIX-LIBS]** is explicit: scrollytelling "does not
alter scroll behavior, but simply monitors it"; scrolljacking (manipulating scroll with JS) is "bad
practice." It also breaks keyboard/scrollbar/AT navigation. — **Gotcha:** "smooth scroll" libraries
(e.g. Lenis) are a _virtualized native scroll_, acceptable for easing; they MUST remain optional and
MUST be disabled under `prefers-reduced-motion`. Hijacking page-down to force-advance one step at a
time is scrolljacking — forbidden.

**Maps to flan-zines:** the curated preset palette is the safety boundary. There is no "scrolljack"
preset and there must never be one. Students pick `sticky-steps`; they cannot author scroll capture.

---

## 2. The canonical sticky-graphic structure

This is the one structure to learn. Everything (`sticky-steps`, `pin-horizontal`, `scroll-zoom`) is a
variation of it. **[SCROLLAMA]**, **[STICKY]**

```
<section> (the scroll container — establishes the scroll range)
├── <figure class="sticky">   ← the graphic. Sticks while the steps scroll past.
└── <div class="steps">       ← the prose. One <div.step data-index> per state.
        step 0, step 1, step 2 …
```

**Lifecycle** (what the renderer wires, never the document):

1. Graphic scrolls up into view → **sticks** (enters fixed/sticky state).
2. Each step crosses the trigger line → fires `enter` → renderer updates graphic to that step's state.
3. Last step scrolls past → graphic **unsticks** and pins to the bottom of the container, so the next
   normal-flow content follows cleanly. **[SCROLLAMA]**

**Pattern (our stack — the renderer, not the author, writes this):**

```svelte
<!-- StickyStepsRender.svelte (conceptual) -->
<section bind:this={container} class="scrolly">
	<figure class="sticky">
		<!-- graphic reflects `current` -->
		<GraphicForStep index={current} {steps} />
	</figure>
	<div class="steps">
		{#each steps as step, i}
			<div class="step" data-index={i}>{@render step.body()}</div>
		{/each}
	</div>
</section>
```

```css
/* The sticky behavior is two lines of CSS. Do not reimplement it in JS. [STICKY] */
.scrolly .sticky {
	position: sticky;
	top: 0;
}
```

---

## 3. Stick with CSS `position: sticky`, not JavaScript

**Rule:** Use `position: sticky; top: 0;` on the graphic. SHOULD NOT compute the stuck state in JS. —
**Why:** **[STICKY]** — offloading "stuck state, dimensions, etc." to CSS means "less bugs, less
maintenance." JS scroll-driven sticking is janky: the listener "might fall out-of-sync … causing an
element to jump into place instead of … smooth locking." — **Pattern:** a `sticky` element is
positioned relative to its **parent**, so it sticks/unsticks within the parent's bounds — make the
`<section>` exactly bound the scroll range, and you control overlap of consecutive sticky graphics for
free. — **Gotcha:** `position: sticky` fails silently in unsupported engines (legacy) — but
_gracefully_: the element stays in normal source order. That is only acceptable **if you authored the
content to read in source order** (Rule 5). Use a feature query for an enhanced fallback when needed:

```css
@supports (position: sticky) {
	/* enhanced sticky layout */
}
```

---

## 4. Trigger steps with IntersectionObserver (Scrollama), not scroll events

**Rule:** Step triggers MUST use `IntersectionObserver`. AVOID `window.addEventListener('scroll', …)`
for triggering. — **Why:** **[SCROLLAMA]** — scroll events "contribute towards a sluggish experience";
IntersectionObserver "abstracts element-in-view detection and removes the need to monitor scroll
events." This is our Chromebook performance budget in action. — **Pattern:** use **Scrollama** (our
chosen library) for the step lifecycle; keep one state machine keyed by step index.

```ts
// inside the preset's lazy-loaded impl
const scroller = scrollama();
scroller
	.setup({ step: '.step', offset: 0.5 /* trigger at mid-viewport */, debug: false })
	.onStepEnter(({ index }) => setCurrent(index)); // single source of truth: index → state
```

**Maps to flan-zines:** Scrollama is the engine behind the `sticky-steps` preset
([ARCHITECTURE.md §5](../../ARCHITECTURE.md)). The descriptor only lists step ids; the impl wires
Scrollama. Load it lazily (`load: () => import(...)`) so text-only zines never ship it.

---

## 5. The document declares state; the renderer owns the math

**Rule:** A scroll animation in the document is **data** — an ordered list of steps, each mapping to a
graphic state. The author/editor MUST NOT emit DOM offsets, pixel positions, or trigger code. — **Why:**
this is the project's load-bearing principle (author ≡ published; editor and renderer evolve
independently) and it matches **[SCROLLAMA]**'s own advice: put a `data-step`/`data-index` on each step
and "map it to an array or object in your JS with more detailed data or actions." — **Pattern:** a
single source of truth: `index → state`. The graphic is a pure function of the current index.

```jsonc
// document descriptor (what the student authors, via presets + knobs)
{ "type": "sticky-steps", "steps": ["blk_03", "blk_04", "blk_05"] }
```

```ts
// renderer: derive, never imperatively mutate scattered DOM
const state = $derived(stepStates[current]); // current comes from Scrollama
```

**Gotcha:** do **not** special-case a block type inside the renderer to make a scroll effect work. New
scroll behavior = a new **animation preset** in the registry (schema + lazy impl + reduced-motion
fallback), never an edit to `ZineRenderer`. (Golden rule, [IMPLEMENTATION_PLAN.md §6](../../IMPLEMENTATION_PLAN.md).)

---

## 6. Reduced motion and graceful degradation are the same design

**Rule:** Every scroll preset MUST declare a reduced-motion fallback, and that fallback MUST be the
same thing a non-supporting browser sees: **the steps stacked in source order, fully readable, graphic
shown statically (final or first state).** — **Why:** **[STICKY]**'s degradation story ("the element
will stay static in the source order it was added") and our a11y invariant ("no information conveyed by
motion alone") are the _same requirement_. If you author for graceful degradation, you get
reduced-motion almost for free. — **Pattern:** gate all motion behind the reduced-motion check; when
reduced, render `{#each steps}` as normal-flow sections and skip Scrollama/sticky entirely.

```ts
import { prefersReducedMotion } from '$lib/a11y/reduced-motion';
if (prefersReducedMotion.current) return; // no pin, no scrub, no IO — plain stacked steps
```

**Reduced-motion fallback per preset:**

| Preset           | Motion version                            | Reduced / degraded version                   |
| ---------------- | ----------------------------------------- | -------------------------------------------- |
| `sticky-steps`   | Pinned graphic, steps drive its state     | Stacked steps; graphic static near its step  |
| `pin-horizontal` | Section pins, content translates sideways | Normal vertical flow; no pin, no x-translate |
| `scroll-zoom`    | Element scales/translates from an edge    | Element shown at final scale, no scrub       |
| `parallax`       | Layers drift at different speeds          | Layers static (`passthrough`)                |
| `fade-up`        | Enters on scroll into view                | Shown immediately, no transform              |

---

## 7. Pacing and step authoring

**Rule:** SHOULD keep stories short ("a few steps to grab the user and make your point and then you're
out"). One idea per step. — **Why:** **[RESPONSIVE]** — long scrollytelling is "fatiguing or tiresome,"
especially on mobile. — **Pattern:** the editor SHOULD nudge students toward few, meaningful steps;
templates SHOULD ship 3–5 steps, not 15. — **Gotcha:** only keep a transition scroll-driven when the
motion _is_ the meaning (change over time, spatial movement). Decorative step-churn is noise; prefer a
static block. **[RESPONSIVE]**

---

## 8. Choosing the scroll pattern (decision table)

| If the story needs…                                  | Use preset       | Backed by                     | Note                                         |
| ---------------------------------------------------- | ---------------- | ----------------------------- | -------------------------------------------- |
| One graphic, prose steps changing its state          | `sticky-steps`   | Scrollama + `position:sticky` | The default Pudding pattern. **[SCROLLAMA]** |
| Side-scroll: read down → content moves sideways      | `pin-horizontal` | GSAP ScrollTrigger (pin + x)  | Heavy; mobile fallback to vertical flow      |
| A chart/image to grow in from an edge tied to scroll | `scroll-zoom`    | GSAP ScrollTrigger (scrub)    | Transform/opacity only                       |
| An element to appear when scrolled into view         | `fade-up`        | IntersectionObserver          | Cheapest; no library needed                  |
| Layered depth on scroll                              | `parallax`       | Svelte motion / GSAP scrub    | Transform only; disable under reduced-motion |

**Library choice is already made** (Scrollama + GSAP). **[SIX-LIBS]** evaluated six libraries
(Waypoints, ScrollStory, ScrollMagic, graph-scroll, in-view, roll-your-own) and Russell then wrote
Scrollama to supersede them via IntersectionObserver. Do not introduce another step-trigger library;
do not roll your own scroll loop unless a preset provably cannot be expressed with Scrollama + GSAP.

---

## 9. Side-by-side vs text-overlay layout

**Rule:** `sticky-steps` MAY render graphic-and-steps **side-by-side** (desktop) or **steps overlaid on
a full-bleed graphic** (narrow screens). Choose per breakpoint, not per author whim. — **Why:**
**[STICKY]** ships both; the overlay form is the mobile-friendly default when horizontal room is scarce.
— **Pattern:** drive the switch with `matchMedia` (see [responsive-and-performance.md](responsive-and-performance.md)),
sharing one state machine. — **Gotcha:** the graphic is positioned relative to the sticky parent, not
the viewport; size the sticky region to the viewport in **px computed from `window.innerHeight`**, never
`vh` (mobile-navbar trap — see [responsive-and-performance.md](responsive-and-performance.md) §3).

---

## Implementation checklist (every scroll preset)

- [ ] Lives in `src/lib/zine/animations/<preset>/` with `schema.ts`, a **lazily** `load()`-ed impl, and
      a reduced-motion fallback. Registered in the animation registry — **no edits to `ZineRenderer`**.
- [ ] Triggers via Scrollama (`IntersectionObserver`); **no scroll-event listener**.
- [ ] Sticking via CSS `position: sticky` where applicable; **no JS sticky math**.
- [ ] Animates **transform/opacity only** (GPU-friendly; see perf doc).
- [ ] Heavy lib (GSAP) is dynamically imported; absent from the base bundle.
- [ ] Mounts near-viewport, unmounts/cleans up off-screen (IO + Scrollama `destroy()` / GSAP `kill()`).
- [ ] `prefers-reduced-motion` → declared fallback; story still readable in plain source order.
- [ ] Step state is a pure function of `index`; document declares steps only.
- [ ] Deterministic visual test (scroll seeked to fixed positions) per [IMPLEMENTATION_PLAN.md §3](../../IMPLEMENTATION_PLAN.md).

---

## Sources

- **[SCROLLAMA]** An Introduction to Scrollama.js — Russell Samora
- **[STICKY]** Easier scrollytelling with position sticky — Elaina Natario & Russell Samora
- **[SIX-LIBS]** How to implement scrollytelling with six different libraries — Russell Samora
- **[RESPONSIVE]** Responsive scrollytelling best practices — Russell Samora
