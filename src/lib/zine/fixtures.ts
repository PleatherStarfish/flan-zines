// A representative fixture zine used by the public route, tests, and Storybook.
// It is intentionally RAW (`unknown`) so consumers run it through `parseDocument` —
// proving the contract end to end. It uses all six core blocks, scene timelines,
// generative backgrounds, side-scroll, and free path choreography.

type RichMark =
	| { type: 'bold' }
	| { type: 'italic' }
	| { type: 'link'; attrs: { href: string; target?: string } };

function t(text: string, marks?: RichMark[]) {
	return marks?.length ? { type: 'text' as const, text, marks } : { type: 'text' as const, text };
}

function bold(): RichMark {
	return { type: 'bold' };
}

function italic(): RichMark {
	return { type: 'italic' };
}

function link(href: string): RichMark {
	return { type: 'link', attrs: { href } };
}

function paragraph(...content: ReturnType<typeof t>[]) {
	return { type: 'paragraph' as const, content };
}

function bulletList(...items: string[]) {
	return {
		type: 'bulletList' as const,
		content: items.map((item) => ({
			type: 'listItem' as const,
			content: [paragraph(t(item))]
		}))
	};
}

function orderedList(...items: string[]) {
	return {
		type: 'orderedList' as const,
		content: items.map((item) => ({
			type: 'listItem' as const,
			content: [paragraph(t(item))]
		}))
	};
}

function doc(...content: unknown[]) {
	return { type: 'doc' as const, content };
}

export const sampleZineMeta = {
	user: 'riverwild',
	slug: 'hidden-rivers-under-the-city',
	title: 'Hidden Rivers Under the City',
	author: 'Riverwild Field Notes'
};

export const sampleZineRaw: unknown = {
	schemaVersion: 5,
	theme: {
		fontPair: 'editorial',
		preset: 'pixel-press',
		swatches: ['#14152A', '#FFF3C4', '#22A6B3', '#E14F8B', '#78B159', '#F5B82E'],
		colors: {
			background: '#FFF3C4',
			text: '#14152A',
			heading: '#14152A',
			accent: '#E14F8B',
			muted: '#5C5A72'
		}
	},
	acts: [
		{
			id: 'act_hidden_water',
			title: 'Hidden water',
			scenes: [
				{
					id: 'scn_cover',
					type: 'page',
					length: 'auto',
					presentation: { legacyLayout: 'centered', legacyKind: 'prose' },
					background: { color: '#FFF3C4' },
					beats: [{ id: 'beat_cover_start', at: 0 }],
					elements: [
						{
							id: 'el_cover_heading',
							track: 'content',
							range: { start: 0.03, end: 0.78 },
							enter: {
								type: 'fly-in',
								params: { speed: 'medium', direction: 'left' }
							},
							motion: { type: 'float', params: { speed: 'slow', amount: 'subtle' } },
							block: {
								id: 'blk_cover_heading',
								type: 'heading',
								props: { text: 'A suspiciously specific field guide to storm drains', level: 2 },
								style: { align: 'center' }
							}
						},
						{
							id: 'el_cover_text',
							track: 'content',
							range: { start: 0.05, end: 1 },
							enter: {
								type: 'slide',
								params: { speed: 'fast', amount: 'medium', direction: 'right' }
							},
							block: {
								id: 'blk_cover_text',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'I started mapping runoff because the same curb at 9th and Willow made a nickel-colored puddle exactly 18 minutes after rain began. That is not rigorous hydrology, but it is a very good way to become annoying on walks.'
											)
										),
										paragraph(
											t('The official map calls the grates '),
											t('assets', [italic()]),
											t(
												'. The rain calls them low points. This zine follows one storm through roof leaders, curb openings, a combined pipe, and a creek that got daylighted after a century underground. Think '
											),
											t('reported prose with a tiny hydrograph brain', [bold()]),
											t(', plus the visual-essay energy I love in places like '),
											t('The Pudding', [link('https://pudding.cool')]),
											t('.')
										),
										bulletList(
											'Find the crown of the road, not the prettiest puddle.',
											'Identify the inlet: grated, curb-opening, or combo, because each one fails differently.',
											'Assume the first few millimeters of runoff are the grossest and write down what they probably picked up.'
										)
									)
								}
							}
						},
						{
							id: 'el_cover_image',
							track: 'media',
							range: { start: 0.22, end: 1 },
							enter: { type: 'fly-in', params: { speed: 'slow', direction: 'down' } },
							motion: { type: 'ken-burns', params: { speed: 'slow', amount: 'medium' } },
							block: {
								id: 'blk_cover_image',
								type: 'image',
								props: {
									src: '/hidden-rivers-cutaway.webp',
									alt: 'Pixel zine cutaway of a rainy city sidewalk, storm drain, brick pipe, and daylighted creek',
									width: 1586,
									height: 992,
									caption:
										'The sidewalk is a level map: roof runoff, curb inlet, brick barrel, daylighted creek.'
								}
							}
						}
					]
				},
				{
					id: 'scn_rain_alarm',
					type: 'feature',
					length: 'long',
					scrollLength: 4,
					background: {
						color: '#D9F0E8',
						fill: {
							kind: 'canvas',
							preset: 'drift-field',
							params: { density: 'strong', speed: 'fast', tint: 'cool' }
						},
						overlay: { color: '#14152A', opacity: 0.08 }
					},
					beats: [
						{ id: 'beat_rain_first_drop', at: 0, label: 'First drops' },
						{ id: 'beat_rain_gutter', at: 0.38, label: 'Gutter' },
						{ id: 'beat_rain_pipe', at: 0.72, label: 'Pipe' }
					],
					elements: [
						{
							id: 'el_rain_heading',
							track: 'content',
							range: { start: 0.05, end: 0.46 },
							enter: { type: 'fly-in', params: { speed: 'medium', direction: 'left' } },
							exit: { type: 'fade', params: { speed: 'fast' } },
							block: {
								id: 'blk_rain_heading',
								type: 'heading',
								props: { text: 'Minute 0-7: the pavement wakes up', level: 2 }
							}
						},
						{
							id: 'el_rain_text',
							track: 'content',
							range: { start: 0.25, end: 0.9 },
							enter: {
								type: 'rise',
								params: { speed: 'medium', amount: 'strong', direction: 'up' }
							},
							motion: { type: 'float', params: { speed: 'slow', amount: 'subtle' } },
							block: {
								id: 'blk_rain_text',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'The first minutes of a storm are not romantic. They are a solvent test. Roof grit, tire dust, pollen, pulverized leaf bits, brake-pad metal, and snack-wrapper archaeology all start moving before the street has even decided where the puddles live.'
											)
										),
										orderedList(
											'Roof: 1 mm of rain on 1 square meter is 1 liter, so a 6 mm shower on a 60 square meter roof is suddenly 360 liters looking for a downspout.',
											'Curb: sheet flow becomes gutter flow once it finds the longitudinal slope; every leaf mat is a tiny, terrible detention basin.',
											'Pipe: in an old combined system, the cute sidewalk stream becomes a capacity problem with a pipe diameter.'
										),
										paragraph(
											t(
												"That is why the boring details matter: curb reveal height, inlet spacing, grate clogging, soil infiltration, and whether the street gives water a place to pause before it becomes somebody downstream's problem."
											)
										)
									)
								}
							}
						}
					]
				},
				{
					id: 'scn_measure',
					type: 'data',
					length: 'long',
					scrollLength: 5,
					background: {
						color: '#14152A',
						fill: {
							kind: 'canvas',
							preset: 'fish-flock',
							params: { density: 'medium', speed: 'slow', tint: 'accent' }
						},
						overlay: { color: '#14152A', opacity: 0.28 }
					},
					beats: [
						{ id: 'beat_measure_listen', at: 0, label: 'Listen' },
						{ id: 'beat_measure_watch', at: 0.36, label: 'Watch' },
						{ id: 'beat_measure_return', at: 0.72, label: 'Return' }
					],
					elements: [
						{
							id: 'el_measure_heading',
							track: 'content',
							range: { start: 0.02, end: 0.28 },
							enter: { type: 'rise', params: { speed: 'fast', amount: 'medium', direction: 'up' } },
							block: {
								id: 'blk_measure_heading',
								type: 'heading',
								props: { text: 'A hydrograph, if you squint', level: 2 }
							}
						},
						{
							id: 'el_measure_first_flush',
							track: 'content',
							range: { start: 0.18, end: 0.48 },
							enter: {
								type: 'slide',
								params: { speed: 'medium', amount: 'medium', direction: 'right' }
							},
							exit: { type: 'fade', params: { speed: 'medium' } },
							block: {
								id: 'blk_measure_first_flush',
								type: 'heading',
								props: { text: '1. First flush is not a metaphor', level: 3 }
							}
						},
						{
							id: 'el_measure_first_flush_text',
							track: 'content',
							range: { start: 0.24, end: 0.52 },
							enter: { type: 'fade', params: { speed: 'medium' } },
							exit: { type: 'fade', params: { speed: 'medium' } },
							block: {
								id: 'blk_measure_first_flush_text',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'The first pulse looks cloudy because pavement has been dry-storage for everything the block forgot about. In my notebook, the useful observation is not "dirty water." It is timing: cloudy at t+6 minutes, clearer by t+31, leaf line 14 cm above yesterday\'s baseflow.'
											)
										)
									)
								}
							}
						},
						{
							id: 'el_measure_overflow',
							track: 'content',
							range: { start: 0.45, end: 0.74 },
							enter: {
								type: 'slide',
								params: { speed: 'medium', amount: 'medium', direction: 'left' }
							},
							exit: { type: 'fade', params: { speed: 'medium' } },
							block: {
								id: 'blk_measure_overflow',
								type: 'heading',
								props: { text: '2. The overflow window', level: 3 }
							}
						},
						{
							id: 'el_measure_overflow_text',
							track: 'content',
							range: { start: 0.51, end: 0.78 },
							enter: { type: 'fade', params: { speed: 'medium' } },
							exit: { type: 'fade', params: { speed: 'medium' } },
							block: {
								id: 'blk_measure_overflow_text',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'Combined sewer overflow is not a cartoon villain; it is math with bad vibes. The pipe has dry-weather flow, storm inflow, groundwater sneaking in through joints, and whatever storage the system can borrow before it has to spill.'
											)
										)
									)
								}
							}
						},
						{
							id: 'el_measure_return',
							track: 'content',
							range: { start: 0.68, end: 0.96 },
							enter: { type: 'pop', params: { speed: 'medium', amount: 'medium' } },
							block: {
								id: 'blk_measure_return',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'By the next morning, the channel pretends nothing happened. The evidence is tiny and excellent: '
											),
											t('a leaf line', [bold()]),
											t(
												', pea gravel sorted on the inside bend, a damp brick arch, and one new sandbar exactly where the outfall punches the current.'
											)
										)
									)
								}
							}
						}
					]
				},
				{
					id: 'scn_drop_level',
					type: 'sidescroll',
					length: 'long',
					scrollAxis: 'horizontal',
					scrollLength: 6,
					background: {
						color: '#5BC7DD',
						fill: {
							kind: 'canvas',
							preset: 'organic-gradient',
							params: {
								colors: [1, 2, 4, 5],
								placement: 'scattered',
								count: 'many',
								motion: 'scroll',
								opacity: 'vivid'
							}
						},
						overlay: { color: '#14152A', opacity: 0.1 }
					},
					beats: [
						{ id: 'beat_drop_roof', at: 0, label: 'Roof' },
						{ id: 'beat_drop_grate', at: 0.35, label: 'Grate' },
						{ id: 'beat_drop_creek', at: 0.75, label: 'Creek' }
					],
					elements: [
						{
							id: 'el_drop_rain_back',
							track: 'background',
							range: { start: 0.04, end: 0.24 },
							motion: {
								type: 'parallax',
								params: { speed: 'slow', amount: 'strong', direction: 'down' }
							},
							block: {
								id: 'blk_drop_rain_back',
								type: 'image',
								props: {
									src: '/rain-parallax-layer.svg',
									alt: 'Distant slanted rain streaks behind the runoff path',
									width: 900,
									height: 260
								}
							}
						},
						{
							id: 'el_drop_level_title',
							track: 'content',
							range: { start: 0.02, end: 0.18 },
							block: {
								id: 'blk_drop_level_title',
								type: 'heading',
								props: { text: 'Runoff as a very fussy side-scroller', level: 2 }
							}
						},
						{
							id: 'el_drop_splash_front',
							track: 'background',
							range: { start: 0.28, end: 0.9 },
							motion: {
								type: 'parallax',
								params: { speed: 'medium', amount: 'strong', direction: 'up' }
							},
							block: {
								id: 'blk_drop_splash_front',
								type: 'image',
								props: {
									src: '/splash-parallax-layer.svg',
									alt: 'Foreground curb splashes and runoff ripples crossing the side-scroll scene',
									width: 900,
									height: 260
								}
							}
						},
						{
							id: 'el_drop_vector_trail',
							track: 'background',
							placement: 'free',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_drop_vector_trail',
								type: 'image',
								props: {
									src: '/runoff-vector-trail.svg',
									alt: 'Dashed multi-point vector trail with waypoint dots showing the raindrop jump path',
									width: 900,
									height: 520
								}
							}
						},
						{
							id: 'el_drop_roof',
							track: 'media',
							range: { start: 0.14, end: 0.24 },
							block: {
								id: 'blk_drop_roof',
								type: 'heading',
								props: { text: '75 mm green-roof tray', level: 3 }
							}
						},
						{
							id: 'el_drop_grate',
							track: 'media',
							range: { start: 0.36, end: 0.46 },
							block: {
								id: 'blk_drop_grate',
								type: 'heading',
								props: { text: 'curb-opening inlet', level: 3 }
							}
						},
						{
							id: 'el_drop_pipe',
							track: 'media',
							range: { start: 0.58, end: 0.68 },
							block: {
								id: 'blk_drop_pipe',
								type: 'heading',
								props: { text: '450 mm brick barrel', level: 3 }
							}
						},
						{
							id: 'el_drop_creek',
							track: 'media',
							range: { start: 0.82, end: 0.92 },
							block: {
								id: 'blk_drop_creek',
								type: 'heading',
								props: { text: 'daylighted riffle', level: 3 }
							}
						},
						{
							id: 'el_drop_sprite',
							track: 'media',
							placement: 'free',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_drop_sprite',
								type: 'image',
								props: {
									src: '/raindrop-sprite.svg',
									alt: 'Blue raindrop sprite following the runoff path',
									width: 64,
									height: 88
								},
								style: { align: 'center' }
							},
							motion: {
								type: 'path',
								params: {
									waypoints: [
										{ at: 0, x: 8, y: 28, scale: 1.2, rotate: -12, ease: 'smooth' },
										{ at: 0.16, x: 27, y: 74, scale: 1.6, rotate: 18, ease: 'arc' },
										{ at: 0.34, x: 42, y: 34, scale: 1.35, rotate: -18, ease: 'arc' },
										{ at: 0.56, x: 61, y: 78, scale: 1.5, rotate: 22, ease: 'arc' },
										{ at: 0.78, x: 79, y: 38, scale: 1.28, rotate: -14, ease: 'arc' },
										{ at: 1, x: 94, y: 72, scale: 1.55, rotate: 0, ease: 'out' }
									]
								}
							}
						},
						{
							id: 'el_drop_sprite_tail_a',
							track: 'media',
							placement: 'free',
							range: { start: 0.06, end: 0.94 },
							block: {
								id: 'blk_drop_sprite_tail_a',
								type: 'image',
								props: {
									src: '/raindrop-sprite.svg',
									alt: 'Smaller trailing raindrop sprite lagging behind the main runoff path',
									width: 64,
									height: 88
								},
								style: { align: 'center' }
							},
							motion: {
								type: 'path',
								params: {
									waypoints: [
										{ at: 0, x: 4, y: 16, scale: 0.72, rotate: 10, ease: 'smooth' },
										{ at: 0.24, x: 22, y: 66, scale: 0.88, rotate: -16, ease: 'arc' },
										{ at: 0.5, x: 48, y: 50, scale: 0.74, rotate: 18, ease: 'arc' },
										{ at: 0.74, x: 70, y: 82, scale: 0.9, rotate: -12, ease: 'arc' },
										{ at: 1, x: 89, y: 48, scale: 0.72, rotate: 8, ease: 'out' }
									]
								}
							}
						},
						{
							id: 'el_drop_sprite_tail_b',
							track: 'media',
							placement: 'free',
							range: { start: 0.16, end: 1 },
							block: {
								id: 'blk_drop_sprite_tail_b',
								type: 'image',
								props: {
									src: '/raindrop-sprite.svg',
									alt: 'Low bouncing raindrop sprite skimming the curb splash layer',
									width: 64,
									height: 88
								},
								style: { align: 'center' }
							},
							motion: {
								type: 'path',
								params: {
									waypoints: [
										{ at: 0, x: -4, y: 72, scale: 0.62, rotate: -20, ease: 'smooth' },
										{ at: 0.22, x: 24, y: 84, scale: 0.76, rotate: 18, ease: 'arc' },
										{ at: 0.44, x: 46, y: 62, scale: 0.68, rotate: -10, ease: 'arc' },
										{ at: 0.72, x: 68, y: 86, scale: 0.78, rotate: 14, ease: 'arc' },
										{ at: 1, x: 102, y: 76, scale: 0.6, rotate: 0, ease: 'out' }
									]
								}
							}
						}
					]
				},
				{
					id: 'scn_daylight',
					type: 'parallax',
					length: 'long',
					scrollLength: 4,
					background: {
						color: '#E8F7C8',
						fill: {
							kind: 'canvas',
							preset: 'fish-flock',
							params: { density: 'medium', speed: 'medium', tint: 'accent' }
						},
						overlay: { color: '#FFF3C4', opacity: 0.16 }
					},
					beats: [
						{ id: 'beat_daylight_buried', at: 0, label: 'Buried' },
						{ id: 'beat_daylight_open', at: 0.5, label: 'Open' }
					],
					elements: [
						{
							id: 'el_daylight_image',
							track: 'media',
							range: { start: 0.08, end: 0.8 },
							enter: { type: 'fade', params: { speed: 'slow' } },
							motion: {
								type: 'parallax',
								params: { speed: 'slow', amount: 'strong', direction: 'up' }
							},
							block: {
								id: 'blk_daylight_image',
								type: 'image',
								props: {
									src: '/hidden-rivers-cutaway.webp',
									alt: 'Collage-style cutaway showing stormwater infrastructure under a street and an open creek channel',
									width: 1586,
									height: 992,
									caption: 'A good cutaway separates the pipe fantasy from the maintenance reality.'
								}
							}
						},
						{
							id: 'el_daylight_heading',
							track: 'content',
							range: { start: 0.24, end: 0.95 },
							enter: {
								type: 'rise',
								params: { speed: 'medium', amount: 'medium', direction: 'up' }
							},
							block: {
								id: 'blk_daylight_heading',
								type: 'heading',
								props: { text: 'Daylighting is not just creek fan service', level: 2 }
							}
						},
						{
							id: 'el_daylight_text',
							track: 'content',
							range: { start: 0.42, end: 0.98 },
							enter: { type: 'fade', params: { speed: 'medium' } },
							block: {
								id: 'blk_daylight_text',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'To daylight a stream is to confess that infrastructure is not only underground hardware. It is a public space decision with maintenance access, floodplain benches, shade, mosquito paranoia, and neighbors who will absolutely name the first fish.'
											)
										),
										paragraph(
											t(
												'A buried channel moves water quickly and invisibly. An open channel can add roughness, storage, and shade; it can also fail if the banks are decorative instead of hydraulic. The dream is not just pretty water. It is water that can '
											),
											t('cool the block', [bold()]),
											t(
												', survive a maintenance budget, teach the watershed, and still pass the next ugly storm.'
											)
										)
									)
								}
							}
						}
					]
				},
				{
					id: 'scn_field_kit',
					type: 'page',
					length: 'auto',
					presentation: { legacyLayout: 'centered', legacyKind: 'sources' },
					background: { color: '#FFF3C4' },
					beats: [{ id: 'beat_field_kit_start', at: 0 }],
					elements: [
						{
							id: 'el_field_divider',
							track: 'content',
							range: { start: 0, end: 1 },
							block: { id: 'blk_field_divider', type: 'divider', props: {} }
						},
						{
							id: 'el_field_heading',
							track: 'content',
							range: { start: 0, end: 1 },
							enter: {
								type: 'rise',
								params: { speed: 'medium', amount: 'subtle', direction: 'up' }
							},
							block: {
								id: 'blk_field_heading',
								type: 'heading',
								props: { text: 'Field kit for the hydrology person you are becoming', level: 2 }
							}
						},
						{
							id: 'el_field_methods',
							track: 'content',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_field_methods',
								type: 'richText',
								props: {
									doc: doc(
										paragraph(
											t(
												'Try this after a safe, ordinary rainstorm. Bring a pencil, a zip bag for your phone, shoes you can forgive, and the correct amount of cowardice around moving water. Stay on public paths; do not pry, climb, taste, or heroic-narrative your way into a culvert.'
											)
										),
										bulletList(
											'Mark the exact rain start time. "After lunch" is vibes; t+12 minutes is data.',
											'Draw the curb cross-section: crown, gutter, ponding edge, inlet throat, leaf mat.',
											'Record any inlet ID you can read from the sidewalk, but leave every lid exactly where the city put it.',
											'Photograph the same spot at t+10 minutes, t+60 minutes, and t+24 hours.'
										),
										paragraph(
											t(
												'Then make the zine with the discipline of a tiny field report: one observation, one image, one motion, one question you cannot quite answer yet.'
											)
										)
									)
								}
							}
						},
						{
							id: 'el_field_spacer',
							track: 'content',
							range: { start: 0, end: 1 },
							block: { id: 'blk_field_spacer', type: 'spacer', props: { size: 'md' } }
						},
						{
							id: 'el_field_cta',
							track: 'content',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_field_cta',
								type: 'linkButton',
								props: {
									href: 'https://pudding.cool',
									label: 'Read visual essays at The Pudding',
									variant: 'button',
									newTab: true
								},
								style: { align: 'center' }
							}
						}
					]
				}
			]
		}
	]
};
