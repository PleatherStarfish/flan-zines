// The animation (effect) registry — the second extension point (IMPLEMENTATION_PLAN.md
// §2; scene-timeline.md §5). The document schema, inspector funnel, timeline, and
// renderer read ONLY from here; nothing in the core hard-codes an effect list. Adding an
// effect = one `registerEffect(...)` line below + its params schema + a lazy `load()` +
// a reduced-motion fallback. See docs/adding-an-effect.md.
import type { AnimationDef, AnyAnimationDef, EffectImpl, EffectSlot } from './contract';
import {
	AMOUNT_KNOB,
	AXIS_DIRECTION_KNOB,
	DIRECTION_KNOB,
	FROM_KNOB,
	FadeParamsSchema,
	FloatParamsSchema,
	FlyInParamsSchema,
	KenBurnsParamsSchema,
	ParallaxParamsSchema,
	PopParamsSchema,
	RiseParamsSchema,
	SPEED_KNOB,
	SlideParamsSchema,
	type FadeParams,
	type FloatParams,
	type FlyInParams,
	type KenBurnsParams,
	type ParallaxParams,
	type PopParams,
	type RiseParams,
	type SlideParams
} from './schema';

const effects = new Map<string, AnyAnimationDef>();

export function registerEffect<P>(def: AnimationDef<P>): void {
	if (effects.has(def.type)) {
		throw new Error(`Duplicate effect type registered: "${def.type}".`);
	}
	effects.set(def.type, def as AnyAnimationDef);
}

export function getEffect(type: string): AnyAnimationDef | undefined {
	return effects.get(type);
}

export function allEffects(): AnyAnimationDef[] {
	return [...effects.values()];
}

export function effectIds(): string[] {
	return [...effects.keys()];
}

/** The effects offerable in a given slot (and optionally a single Funnel-B group). */
export function effectsForSlot(
	slot: EffectSlot,
	group?: AnyAnimationDef['group']
): AnyAnimationDef[] {
	return allEffects().filter(
		(def) => def.slots.includes(slot) && (group ? def.group === group : true)
	);
}

// ── The curated catalogue ───────────────────────────────────────────────────────────
// Appear / Leave — fill the `enter` and `exit` slots (one definition powers both).

registerEffect<FadeParams>({
	type: 'fade',
	label: 'Fade',
	group: 'appear',
	slots: ['enter', 'exit'],
	icon: '🌫️',
	schema: FadeParamsSchema,
	defaults: FadeParamsSchema.parse({}),
	knobs: [SPEED_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/appear').then((m) => m.fade as EffectImpl<FadeParams>)
});

registerEffect<RiseParams>({
	type: 'rise',
	label: 'Rise',
	group: 'appear',
	slots: ['enter', 'exit'],
	icon: '⬆️',
	schema: RiseParamsSchema,
	defaults: RiseParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB, AXIS_DIRECTION_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/appear').then((m) => m.rise as EffectImpl<RiseParams>)
});

registerEffect<SlideParams>({
	type: 'slide',
	label: 'Slide',
	group: 'appear',
	slots: ['enter', 'exit'],
	icon: '↔️',
	schema: SlideParamsSchema,
	defaults: SlideParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB, DIRECTION_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/appear').then((m) => m.slide as EffectImpl<SlideParams>)
});

registerEffect<PopParams>({
	type: 'pop',
	label: 'Pop',
	group: 'appear',
	slots: ['enter', 'exit'],
	icon: '✨',
	schema: PopParamsSchema,
	defaults: PopParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/appear').then((m) => m.pop as EffectImpl<PopParams>)
});

registerEffect<FlyInParams>({
	type: 'fly-in',
	label: 'Fly in',
	group: 'appear',
	slots: ['enter', 'exit'],
	icon: '🛬',
	schema: FlyInParamsSchema,
	defaults: FlyInParamsSchema.parse({}),
	knobs: [SPEED_KNOB, FROM_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/appear').then((m) => m.flyIn as EffectImpl<FlyInParams>)
});

// Keep moving — fill the `motion` slot (sustained motion while on screen).

registerEffect<ParallaxParams>({
	type: 'parallax',
	label: 'Parallax',
	group: 'motion',
	slots: ['motion'],
	icon: '🏞️',
	schema: ParallaxParamsSchema,
	defaults: ParallaxParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB, AXIS_DIRECTION_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/motion').then((m) => m.parallax as EffectImpl<ParallaxParams>)
});

registerEffect<FloatParams>({
	type: 'float',
	label: 'Float',
	group: 'motion',
	slots: ['motion'],
	icon: '🎈',
	schema: FloatParamsSchema,
	defaults: FloatParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/motion').then((m) => m.float as EffectImpl<FloatParams>)
});

registerEffect<KenBurnsParams>({
	type: 'ken-burns',
	label: 'Gentle zoom',
	group: 'motion',
	slots: ['motion'],
	icon: '🔍',
	schema: KenBurnsParamsSchema,
	defaults: KenBurnsParamsSchema.parse({}),
	knobs: [SPEED_KNOB, AMOUNT_KNOB],
	reducedMotion: 'static',
	load: () => import('./impls/motion').then((m) => m.kenBurns as EffectImpl<KenBurnsParams>)
});
