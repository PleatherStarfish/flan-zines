import { describe, expect, it } from 'vitest';
import { DocumentError, parseDocument, publishBlockers, safeParseDocument } from './migrate';
import { sceneScrollScreens } from './document';
import { sampleZineRaw } from '../fixtures';

const wrap = (block: unknown) => ({
	schemaVersion: 1,
	sections: [{ id: 'sec', blocks: [block] }]
});

describe('document schema', () => {
	it('parses the sample fixture as the current v3 story model', () => {
		const doc = parseDocument(sampleZineRaw);
		expect(doc.schemaVersion).toBe(5);
		expect(doc.acts).toHaveLength(1);
		expect(doc.acts[0].scenes).toHaveLength(2);
		expect(doc.acts[0].scenes[0].type).toBe('page');
		expect(doc.acts[0].scenes[0].presentation?.legacyLayout).toBe('centered');
	});

	it('returns registry-parsed block props, including defaults', () => {
		const doc = parseDocument(wrap({ id: 'b', type: 'heading', props: { text: 'Default me' } }));
		expect(doc.acts[0].scenes[0].elements[0].block.props).toEqual({
			text: 'Default me',
			level: 2
		});
	});

	it('rejects a page scene without exactly one beat at 0', () => {
		const result = safeParseDocument({
			schemaVersion: 5,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'page',
							length: 'auto',
							beats: [{ id: 'beat', at: 0.5 }],
							elements: []
						}
					]
				}
			]
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/one beat at 0/i);
	});

	it('rejects an element anchorBeat outside its scene', () => {
		const result = safeParseDocument({
			schemaVersion: 5,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'feature',
							length: 'auto',
							beats: [{ id: 'beat', at: 0 }],
							elements: [
								{
									id: 'el',
									track: 'content',
									block: { id: 'b', type: 'heading', props: { text: 'x' } },
									range: { start: 0, end: 1 },
									anchorBeat: 'missing'
								}
							]
						}
					]
				}
			]
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/anchorBeat/i);
	});

	it('rejects an unknown block type with a clear, pointed error', () => {
		const result = safeParseDocument(wrap({ id: 'b', type: 'whoops', props: {} }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/Unknown block type: "whoops"/);
	});

	it('rejects invalid block props with a props-path error', () => {
		// heading requires non-empty `text`
		const result = safeParseDocument(wrap({ id: 'b', type: 'heading', props: { level: 2 } }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/props/);
	});

	it('rejects an unsafe (javascript:) link URL', () => {
		const result = safeParseDocument(
			wrap({ id: 'b', type: 'linkButton', props: { href: 'javascript:alert(1)', label: 'x' } })
		);
		expect(result.ok).toBe(false);
	});

	it('rejects a rich-text link with an unsafe URL', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'x',
							marks: [{ type: 'link', attrs: { href: 'data:text/html,x' } }]
						}
					]
				}
			]
		};
		expect(safeParseDocument(wrap({ id: 'b', type: 'richText', props: { doc } })).ok).toBe(false);
	});

	it('rejects unsafe author-controlled CSS values before render', () => {
		expect(
			safeParseDocument({
				schemaVersion: 1,
				theme: { accent: '#E4572E;background:url(https://example.com/x)' },
				sections: []
			}).ok
		).toBe(false);

		expect(
			safeParseDocument({
				schemaVersion: 1,
				sections: [{ id: 'sec', background: { color: 'url(javascript:alert(1))' }, blocks: [] }]
			}).ok
		).toBe(false);
	});

	it('accepts an image with empty alt as a draft, but flags it at publish time', () => {
		const doc = parseDocument(wrap({ id: 'b', type: 'image', props: { src: '/x.svg', alt: '' } }));
		const blockers = publishBlockers(doc);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toMatch(/alt text/i);
	});

	it('reports no publish blockers for the complete fixture', () => {
		expect(publishBlockers(parseDocument(sampleZineRaw))).toEqual([]);
	});

	it('throws DocumentError for non-object input', () => {
		expect(() => parseDocument(42)).toThrow(DocumentError);
	});

	it('accepts an explicit per-scene scrollLength and resolves scroll distance', () => {
		const doc = parseDocument({
			schemaVersion: 5,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'reveal',
							length: 'auto',
							scrollLength: 6,
							beats: [{ id: 'beat', at: 0 }],
							elements: []
						}
					]
				}
			]
		});
		const scene = doc.acts[0].scenes[0];
		expect(scene.scrollLength).toBe(6);
		expect(sceneScrollScreens(scene)).toBe(6);
		// Page scenes always flow in one screen; timeline scenes fall back to a preset.
		expect(sceneScrollScreens({ type: 'page', length: 'long' })).toBe(1);
		expect(sceneScrollScreens({ type: 'reveal', length: 'long' })).toBe(6);
		expect(sceneScrollScreens({ type: 'reveal', length: 'auto' })).toBe(2);
	});

	it('accepts a scene scrollAxis and rejects an unknown one', () => {
		const make = (axis: string) =>
			safeParseDocument({
				schemaVersion: 5,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'reveal',
								length: 'auto',
								scrollAxis: axis,
								beats: [{ id: 'b', at: 0 }],
								elements: []
							}
						]
					}
				]
			});
		const ok = make('horizontal');
		expect(ok.ok).toBe(true);
		if (ok.ok) expect(ok.document.acts[0].scenes[0].scrollAxis).toBe('horizontal');
		expect(make('diagonal').ok).toBe(false);
	});

	it('validates scene background fills (media URLs + registry-backed canvas presets)', () => {
		const withBg = (background: unknown) =>
			safeParseDocument({
				schemaVersion: 5,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'feature',
								length: 'auto',
								background,
								beats: [{ id: 'b', at: 0 }],
								elements: []
							}
						]
					}
				]
			});

		// canvas preset → params validated + defaulted through the background registry.
		const canvas = withBg({ fill: { kind: 'canvas', preset: 'drift-field' } });
		expect(canvas.ok).toBe(true);
		if (canvas.ok) {
			expect(canvas.document.acts[0].scenes[0].background?.fill).toMatchObject({
				kind: 'canvas',
				preset: 'drift-field',
				params: { density: 'medium', speed: 'slow', tint: 'ink' }
			});
		}

		const unknown = withBg({ fill: { kind: 'canvas', preset: 'nope' } });
		expect(unknown.ok).toBe(false);
		if (!unknown.ok) expect(unknown.error.message).toMatch(/Unknown background/);

		// bad canvas params → rejected.
		expect(
			withBg({ fill: { kind: 'canvas', preset: 'drift-field', params: { density: 'huge' } } }).ok
		).toBe(false);

		// image fill → safe URL + default fit.
		const image = withBg({ fill: { kind: 'image', src: '/bg.svg' } });
		expect(image.ok).toBe(true);
		if (image.ok) {
			expect(image.document.acts[0].scenes[0].background?.fill).toMatchObject({
				kind: 'image',
				src: '/bg.svg',
				fit: 'cover'
			});
		}

		// unsafe media URLs are rejected.
		expect(withBg({ fill: { kind: 'image', src: 'javascript:alert(1)' } }).ok).toBe(false);
		expect(withBg({ fill: { kind: 'video', src: 'https://example.com/clip.mp4' } }).ok).toBe(true);
	});

	it('rejects a scrollLength outside the supported range', () => {
		const result = safeParseDocument({
			schemaVersion: 5,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'reveal',
							length: 'auto',
							scrollLength: 99,
							beats: [{ id: 'beat', at: 0 }],
							elements: []
						}
					]
				}
			]
		});
		expect(result.ok).toBe(false);
	});

	it('accepts a free element with a path motion and round-trips placement', () => {
		const makeFree = (placement: unknown) =>
			safeParseDocument({
				schemaVersion: 5,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'reveal',
								length: 'auto',
								beats: [{ id: 'beat', at: 0 }],
								elements: [
									{
										id: 'el_hero',
										track: 'media',
										placement,
										range: { start: 0, end: 1 },
										block: { id: 'blk', type: 'image', props: { src: '/x.svg', alt: 'hero' } },
										motion: {
											type: 'path',
											params: {
												waypoints: [
													{ at: 0, x: 10, y: 80 },
													{ at: 0.5, x: 50, y: 80, ease: 'arc' },
													{ at: 1, x: 90, y: 40, ease: 'arc' }
												]
											}
										}
									}
								]
							}
						]
					}
				]
			});
		const ok = makeFree('free');
		expect(ok.ok).toBe(true);
		if (ok.ok) {
			const element = ok.document.acts[0].scenes[0].elements[0];
			expect(element.placement).toBe('free');
			// Waypoint defaults (scale/rotate/ease) are filled by the effect schema.
			const params = element.motion?.params as { waypoints: { ease: string; scale: number }[] };
			expect(params.waypoints[0]).toMatchObject({ scale: 1, ease: 'smooth' });
		}
		expect(makeFree('floating').ok).toBe(false); // unknown placement rejected
	});
});
