# Data viz & charts — implementation best practices

**Audience: AI implementing the `dataViz` / chart blocks and choosing a rendering technology.** Governs
Step 4b chart presets, `flockingCanvas`, and any block that draws data. Sources: **[NO-SVG]**,
**[NO-CODE]**, **[PIVOT-SCATTER]**. Pair with [scrollytelling.md](scrollytelling.md) for scroll-scrubbed
charts and [responsive-and-performance.md](responsive-and-performance.md) for the perf budget.

---

## TL;DR (the rules)

1. **SHOULD render box/grid charts as DOM `div`s laid out with Flexbox**, not SVG — when the marks form
   a grid (waffle, stacked bars, histograms-of-blocks, pictograms, heatmaps). **[NO-SVG]**
2. **MUST use SVG/Canvas instead** when you need axis gridlines spanning the plot, free-floating
   annotations, or **smooth position animation** (DOM/Flexbox can't tween between positions). **[NO-SVG]**
3. **SHOULD prototype the chart no-code first** (Flourish/Datawrapper/Figma/Sheets) to settle the form,
   then build the preset. **[NO-CODE]**
4. **MAY add interactivity/spatial encoding when it aids understanding** — it measurably boosts
   engagement — but MUST keep a clear default reading and an anchor/focal point. **[PIVOT-SCATTER]**
5. **MUST give every chart a non-visual reading** (alt text / data table) and MUST NOT encode meaning by
   color alone. (Our a11y invariant.)
6. **MUST pick the technology by mark count** (see §6): DOM for tens, SVG for hundreds, Canvas/WebGL for
   thousands.

---

## 1. The core insight: D3 manipulates the DOM, not just SVG

**[NO-SVG]** dispels three misconceptions that unlock most "simple" Pudding charts:

- D3 binds data to **any** DOM element (`div`, `span`, `p`), not only SVG (`rect`, `circle`, `path`).
- **Flexbox does the alignment math for you** — you stop computing x/y pixel positions by hand.
- SVG's origin is top-left, which makes "grow from the bottom" charts annoying; Flexbox sidesteps the
  whole coordinate headache.

**Rule:** For grid-aligned, box-based charts, build `div`s and let Flexbox position them. — **Why:**
**[NO-SVG]** — it "takes away the need to calculate the exact positioning of all of our blocks and gives
that responsibility to Flexbox." Less math, less code, no SVG-origin confusion. — **Maps to flan-zines:**
DOM charts are the cheapest, most accessible, most Chromebook-friendly default and integrate with normal
CSS theming. Make them the default `dataViz` renderer for box/grid chart types.

---

## 2. Three canonical DOM-chart patterns (build presets on these)

All three are the same idea: a container as a flex parent, data-bound `div`s as marks. **[NO-SVG]**

**Waffle (percentage of a whole, 10×10 grid):**

```css
.waffle {
	display: flex;
	flex-wrap: wrap;
	width: 140px;
}
.block {
	width: 10px;
	height: 10px;
	margin: 2px;
} /* 100 blocks wrap into a grid; color the first N differently */
```

**Modified histogram (a count = N identical stacked blocks, not one tall bar):**

```css
.hist {
	display: flex;
	flex-direction: row;
	align-items: flex-end;
} /* groups sit on a shared baseline */
.group {
	display: flex;
	flex-direction: column;
} /* blocks stack within a group */
```

> **[NO-SVG]:** stacks "hang from the top" until you add `align-items: flex-end` — then they grow from
> the baseline. Internalize this; it's the #1 DOM-chart gotcha.

**Stacked bar (with baseline control + labels):**

```css
.stack {
	display: flex;
	align-items: flex-end;
}
.group {
	display: flex;
	flex-direction: column-reverse;
} /* put the emphasized series on the baseline */
.label {
	order: 0;
} /* month label below */
.block {
	order: 1;
}
.count {
	order: 2;
} /* total above */
```

Heights come from a scale (`d3.scaleLinear`), colors from an ordinal scale — exactly like an
SVG chart, minus `d3.stack()` (Flexbox replaces the stacking math). **[NO-SVG]**

**Maps to flan-zines:** these become parameterized `dataViz` chart-type presets (`waffle`, `barStack`,
`blockHistogram`, `pictogram`). The student supplies data + a few knobs; the preset emits themed `div`s.
The **modified histogram is an excellent student default** — countable, concrete, accessible.

---

## 3. When DOM/Flexbox is the WRONG choice

**Rule:** Use SVG (or Canvas) instead of DOM/Flexbox when ANY of these are true. — **Why/source:**
**[NO-SVG]** states the method's limits outright.

| Requirement                                                        | Use instead    |
| ------------------------------------------------------------------ | -------------- |
| Gridlines/axes that span _behind_ the marks                        | SVG            |
| Annotations that don't line up on the grid                         | SVG            |
| **Smooth animation** of marks between positions (object constancy) | SVG / Canvas   |
| Thousands of marks / 60fps motion                                  | Canvas / WebGL |

**Gotcha (critical):** "Boxes arranged in this way also don't smoothly animate from one position to
another. So, you'll lose object constancy if your graphic includes any animation." **[NO-SVG]** If a
`dataViz` preset needs marks to _transition_ (e.g. a scroll-scrubbed sort or a pivot), it MUST be SVG or
Canvas — do not try to animate Flexbox `order`/reflow.

---

## 4. Prototype no-code, then build the preset

**Rule:** SHOULD settle a chart's form with a no-code tool before writing a preset. — **Why:**
**[NO-CODE]** — The Pudding builds "rapid prototypes and export[s] SVG charts for further refinement";
the right tool depends on the shape:

| Chart shape                           | Prototype with         | **[NO-CODE]** example       |
| ------------------------------------- | ---------------------- | --------------------------- |
| Strip plot                            | Google Sheets / Excel  | "They Won't Play a Lady-O…" |
| Bubble chart                          | Flourish / Datawrapper | "Is the Love Song Dying?"   |
| Scrollytelling stacked bars           | Flourish story         | "Who Gets Shipped and Why?" |
| Box/grid (bar grids, waffle, heatmap) | Figma auto-layout      | "Colors of the Court"       |

**Maps to flan-zines:** two implications. (1) Our chart presets SHOULD cover the shapes that prototype
cleanly (strip, bubble, bar/stack, grid) — they are proven student-legible. (2) A pragmatic MVP for the
`embed` block is to let students paste a Flourish/Datawrapper embed; the native, themed, accessible
`dataViz` preset is the refined version. Treat no-code embeds as the on-ramp, native presets as the
destination. — **Gotcha:** an external embed is a third-party iframe — it bypasses our theming, a11y,
reduced-motion, and privacy guarantees. Gate embeds behind the same moderation/allow-list rules as other
external content; prefer native presets for anything load-bearing.

---

## 5. Interactivity and spatial encoding: powerful, but earn it

**Rule:** Add interaction or extra spatial encoding only when it improves understanding; always keep a
clear default reading and a focal point/anchor. — **Why:** **[PIVOT-SCATTER]** — the weighted pivot
scatter's interactivity "was fun … made the chart more engaging … upwards of 10 minutes on page per
user." Interactivity drives real engagement. But the same article flags the costs: a counterintuitive
axis ("higher = worse") needs a "single focal point to anchor the reader," and elaborate encoding (its
rotated, proportional axes) took "many frustrating hours" of trigonometry for a benefit that was
"maybe not" necessary. — **Maps to flan-zines:**

- Encode with the clearest channels first (position, length, then color/size). Provide an anchor
  (baseline, reference line, or labeled focal point).
- Expose interactivity as **opt-in knobs** on a preset, never as raw code. Default to the static,
  legible reading.
- Every interactive/animated chart MUST have a `prefers-reduced-motion` fallback to its static state
  (no auto-pivot/auto-transition).
- Don't ship encoding the student can't explain. Complexity that needs trig is a preset the _framework_
  owns and tests — not something exposed as a free-form control.

---

## 6. Technology decision: DOM vs SVG vs Canvas/WebGL

**Rule:** Choose by mark count and interaction, not habit.

| Marks / need                                   | Technology         | In our stack                              |
| ---------------------------------------------- | ------------------ | ----------------------------------------- |
| Tens, grid-aligned, themeable, accessible      | **DOM + Flexbox**  | Default `dataViz` box charts **[NO-SVG]** |
| Hundreds, axes/annotations, modest interaction | **SVG** (D3)       | `dataViz` scatter/line/area               |
| Thousands, 60fps, particles/flocking           | **Canvas / WebGL** | `flockingCanvas` via Threlte; Pixi for 2D |

**Rules that cross all three:** transform/opacity-only animation; lazy-import D3/Three.js (absent from
base bundle); mount near-viewport and tear down off-screen; cap counts/FPS and halve density on
low-power screens (see [responsive-and-performance.md](responsive-and-performance.md) §9). **Canvas/WebGL
marks are invisible to assistive tech** — they MUST be backed by a DOM text/table alternative.

---

## 7. Accessibility for charts (non-negotiable)

**Rule:** Every chart MUST (a) carry a concise text description (what it shows + the takeaway), (b)
offer the underlying data in an accessible form (e.g. a visually-hidden table) for non-trivial charts,
(c) never rely on color alone — pair color with label/position/pattern, and (d) honor reduced motion. —
**Why:** WCAG AA is a legal requirement for schools (C2), and a writing class benefits pedagogically
from students articulating the chart's point in words (the same instinct as **[PIVOT]**'s "is it
interesting?"). — **Gotcha:** a DOM/Flexbox chart is _structurally_ present in the DOM but still
semantically opaque — a grid of `div`s says nothing to a screen reader. Add `role`/`aria-label` or a
caption + hidden table; presence in the DOM is not accessibility.

---

## Implementation checklist (a `dataViz` / chart preset)

- [ ] Registered as a block/preset in the registry with a Zod params schema; **no `ZineRenderer` edits**.
- [ ] Technology chosen by §6 (DOM for grids by default; SVG/Canvas only when §3 requires it).
- [ ] If it animates marks between positions → SVG/Canvas (not Flexbox reflow).
- [ ] D3/Three.js dynamically imported; absent from the base bundle.
- [ ] Text description + (for non-trivial charts) accessible data table; no color-only encoding.
- [ ] Interactivity is opt-in knobs with a clear static default + an anchor/focal point.
- [ ] `prefers-reduced-motion` → static state; counts/FPS capped; off-screen teardown.
- [ ] Deterministic visual test for the rendered chart and any scroll-scrubbed states.

---

## Sources

- **[NO-SVG]** Making Data Viz Without SVG Using D3 & Flexbox — Amber Thomas
- **[NO-CODE]** How to recreate our charts without code — Jan Diehm
- **[PIVOT-SCATTER]** The Making of the Weighted Pivot Scatter Plot — Russell Samora
