// A representative fixture zine used by the public route, tests, and Storybook.
// It is intentionally RAW (`unknown`) so consumers run it through `parseDocument` —
// proving the contract end to end. It uses all six core blocks and a valid heading
// outline (page <h1> title → h2 → h3).

export const sampleZineMeta = {
	user: 'riverwild',
	slug: 'why-we-read-at-night',
	title: 'Why We Read at Night',
	author: 'Riverwild'
};

export const sampleZineRaw: unknown = {
	schemaVersion: 3,
	theme: { palette: 'ink', fontPair: 'editorial', accent: '#E4572E' },
	acts: [
		{
			id: 'act_sample',
			title: 'Night',
			scenes: [
				{
					id: 'scn_intro',
					type: 'page',
					length: 'auto',
					presentation: { legacyLayout: 'centered', legacyKind: 'prose' },
					beats: [{ id: 'beat_intro_start', at: 0 }],
					elements: [
						{
							id: 'el_h1',
							track: 'content',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_h1',
								type: 'heading',
								props: { text: 'The lamp-lit hour', level: 2 }
							}
						},
						{
							id: 'el_p1',
							track: 'content',
							range: { start: 0, end: 1 },
							legacyAnimation: { type: 'fade-up', trigger: 'enter', distance: 40 },
							block: {
								id: 'blk_p1',
								type: 'richText',
								props: {
									doc: {
										type: 'doc',
										content: [
											{
												type: 'paragraph',
												content: [
													{ type: 'text', text: 'Some books only make sense ' },
													{ type: 'text', text: 'after dark', marks: [{ type: 'italic' }] },
													{ type: 'text', text: '. The house goes quiet, the ' },
													{ type: 'text', text: 'page glows', marks: [{ type: 'bold' }] },
													{
														type: 'text',
														text: ', and the rest of the world waits. Inspired by '
													},
													{
														type: 'text',
														text: 'The Pudding',
														marks: [{ type: 'link', attrs: { href: 'https://pudding.cool' } }]
													},
													{ type: 'text', text: '.' }
												]
											},
											{
												type: 'bulletList',
												content: [
													{
														type: 'listItem',
														content: [
															{
																type: 'paragraph',
																content: [{ type: 'text', text: 'A single lamp' }]
															}
														]
													},
													{
														type: 'listItem',
														content: [
															{
																type: 'paragraph',
																content: [{ type: 'text', text: 'A cup gone cold' }]
															}
														]
													},
													{
														type: 'listItem',
														content: [
															{
																type: 'paragraph',
																content: [{ type: 'text', text: 'One more chapter' }]
															}
														]
													}
												]
											}
										]
									}
								}
							}
						},
						{
							id: 'el_img',
							track: 'media',
							range: { start: 0, end: 1 },
							legacyAnimation: { type: 'parallax', axis: 'y', speed: 0.4 },
							block: {
								id: 'blk_img',
								type: 'image',
								props: {
									src: '/zine-sample.svg',
									alt: 'A desk lit by a single lamp against a dark window at night',
									caption: 'Reading after the house goes quiet.'
								}
							}
						}
					]
				},
				{
					id: 'scn_why',
					type: 'page',
					length: 'auto',
					presentation: { legacyLayout: 'centered', legacyKind: 'prose' },
					beats: [{ id: 'beat_why_start', at: 0 }],
					elements: [
						{
							id: 'el_div',
							track: 'content',
							range: { start: 0, end: 1 },
							block: { id: 'blk_div', type: 'divider', props: {} }
						},
						{
							id: 'el_h2',
							track: 'content',
							range: { start: 0, end: 1 },
							block: { id: 'blk_h2', type: 'heading', props: { text: 'Why night?', level: 3 } }
						},
						{
							id: 'el_p2',
							track: 'content',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_p2',
								type: 'richText',
								props: {
									doc: {
										type: 'doc',
										content: [
											{
												type: 'paragraph',
												content: [
													{
														type: 'text',
														text: 'Night reading removes the day’s interruptions, so attention has room to stretch.'
													}
												]
											}
										]
									}
								},
								style: { align: 'center' }
							}
						},
						{
							id: 'el_space',
							track: 'content',
							range: { start: 0, end: 1 },
							block: { id: 'blk_space', type: 'spacer', props: { size: 'md' } }
						},
						{
							id: 'el_cta',
							track: 'content',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_cta',
								type: 'linkButton',
								props: {
									href: 'https://pudding.cool',
									label: 'Keep reading',
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
