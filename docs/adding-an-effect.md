# Playbook: add an effect

**Audience: AI (and humans) extending the motion catalogue.** An effect is a curated, student-pickable
animation (Fade, Rise, Parallax, …). The **animation registry is the only extension point**: adding an
effect touches _only_ new files plus one registration line. If you find yourself editing
`render/ZineRenderer.svelte`, `render/timeline.ts`, `schema/document.ts`, or the editor to special-case
a type, stop — that is a design smell and a review blocker (IMPLEMENTATION_PLAN.md §6;
scene-timeline.md §5).

## The contract

Every effect is an [`AnimationDef<P>`](../src/lib/zine/animations/contract.ts):

```ts
interface AnimationDef<P> {
	type: string; // unique EffectId stored in the document (EffectRef.type)
	label: string; // student-facing name
	group: 'appear' | 'motion'; // Funnel B category (scene-timeline.md §6)
	slots: ('enter' | 'exit' | 'motion')[]; // which Element slots it may fill
	icon: string; // emoji/thumbnail hint for the picker
	schema: ZodType<P>; // validates EffectRef.params (≤3 knobs)
	defaults: P; // must pass `schema` (registry test enforces it)
	knobs: KnobMeta[]; // the ≤3 inspector chips (Speed / Direction / Amount)
	editor?: 'path'; // OPTIONAL: a deep authoring surface used INSTEAD of knob chips
	reducedMotion: 'static' | 'passthrough'; // MANDATORY fallback
	load: () => Promise<EffectImpl<P>>; // lazy → impl stays out of the base bundle
}
```

**The deep-`editor` exception.** Almost every effect is ≤3 picture-chips. The one sanctioned exception is
an effect whose params are too rich for chips — the **`path` (Choreograph)** motion, whose `params` are an
ordered list of control points ([`animations/path.ts`](../src/lib/zine/animations/path.ts)). It declares
`editor: 'path'` and `knobs: []`; the [`EffectPicker`](../src/lib/editor/EffectPicker.svelte) then shows an
"Edit the path" button that opens the visual stage ([`PathEditor.svelte`](../src/lib/editor/PathEditor.svelte))
instead of chips. It pairs with a `placement: 'free'` element (a sprite that floats over the scene). The
render path is still a pure `phase → transform` (transform-only): `samplePath()` interpolates the control
points and `pathTransform()` emits a `translate(…cqw/cqh…)` — so it obeys every rule above.

Three rules that keep effects safe, fast, and accessible:

- **Transform/opacity only.** `EffectImpl` returns `{ opacity?, transform? }` — never a raw CSS string.
  This is the GPU-compositor performance boundary and the safety boundary for a tool used by minors.
- **Lazy `load()`.** The impl is `import()`-ed on demand, so a text-only zine ships zero effect code
  (proven by the build report — `appear.js` / `motion.js` are separate chunks).
- **Declare a reduced-motion fallback.** The renderer renders every element neutral + fully visible
  under `prefers-reduced-motion`; `static` is the right choice for the transform/opacity catalogue.

The renderer normalises `phase` before calling the impl (see
[`timeline.ts`](../src/lib/zine/render/timeline.ts)):

- **enter**: `0` at `range.start` → `1` once the appear ramp completes (`1` = neutral/visible).
- **exit**: `1` at the exit ramp's start → `0` at `range.end` (`1` = neutral, `0` = gone).
- **motion**: `0..1` across the element's whole on-screen hold.

So one appear definition powers both the `enter` and `exit` slots.

## The recipe (params + impl + 1 line)

**1. Params schema** — add to [`animations/schema.ts`](../src/lib/zine/animations/schema.ts), reusing the
shared knob enums (`SpeedSchema`, `AmountSchema`, …) and `*_KNOB` metadata so the picker reads
identically across the catalogue:

```ts
export const SpinParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('subtle')
});
export type SpinParams = z.infer<typeof SpinParamsSchema>;
```

**2. Impl** — add a pure `phase → style` function to the relevant lazy module
([`impls/appear.ts`](../src/lib/zine/animations/impls/appear.ts) or
[`impls/motion.ts`](../src/lib/zine/animations/impls/motion.ts)). Transform/opacity only:

```ts
export const spin: EffectImpl<SpinParams> = ({ phase, params }) => ({
	transform: `rotate(${(phase * (params.amount === 'strong' ? 24 : 8)).toFixed(2)}deg)`
});
```

**3. Register it** — one block in [`animations/registry.ts`](../src/lib/zine/animations/registry.ts):

```ts
registerEffect<SpinParams>({
	type: 'spin',
	label: 'Spin',
	group: 'motion',
	slots: ['motion'],
	icon: '🌀',
	schema: SpinParamsSchema,
	defaults: SpinParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/motion').then((m) => m.spin as EffectImpl<SpinParams>)
});
```

**4. Allow it on blocks** — list `'spin'` in the relevant blocks' `allowedAnimations`
(e.g. [`blocks/image/index.ts`](../src/lib/zine/blocks/image/index.ts)). The inspector funnel only offers
an effect where the block allows it.

That is the whole change. `EffectRefSchema` now validates `spin` params, the inspector funnel offers it,
the timeline labels it, and `ZineRenderer` plays it — no core edits.

## Tests to add

- The shared [registry test](../src/lib/zine/animations/registry.test.ts) already covers your effect's
  `defaults`-pass-`schema`, valid group/slots/fallback, ≤3 knobs, lazy transform/opacity-only impl, and
  that every block's `allowedAnimations` is registered — once it's registered.
- Add a deterministic visual story in [`Effects.stories.ts`](../src/lib/zine/animations/Effects.stories.ts)
  (a fixed `sceneProgress` seek per state).
- If the phase math is non-trivial, add a case to
  [`timeline.test.ts`](../src/lib/zine/render/timeline.test.ts).

## Checklist

- [ ] New params schema + impl; **no edits** to `ZineRenderer` / `timeline.ts` / `document.ts` / editor.
- [ ] Transform/opacity only; lazy `load()`; `reducedMotion` declared; ≤3 knobs.
- [ ] Listed in the relevant blocks' `allowedAnimations`.
- [ ] Storybook story + registry coverage; `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` green.

See also: [best-practices/scrollytelling.md](best-practices/scrollytelling.md) (the motion principles
these presets encode) and [design/scene-timeline.md](design/scene-timeline.md) (the authoring model).
