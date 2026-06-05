import { allBlocks } from '$lib/zine/registry';
import type { SceneType } from '$lib/zine/schema/document';
import { newActId, newBeatId, newBlockId, newElementId, newSceneId } from './ids';

// Starter zines (editor.md §6). Raw v2 documents (validated by the create action via
// parseDocument). They encode the editorial gates from
// docs/best-practices/editorial-process.md — notably "Data story" opening with a
// question — to lower the blank-page barrier and teach structure.

type RawBlock = Record<string, unknown>;
type RawElement = Record<string, unknown>;
type RawScene = Record<string, unknown>;

function heading(text: string, level = 2): RawBlock {
	return { id: newBlockId(), type: 'heading', props: { text, level } };
}
function paragraph(text: string): RawBlock {
	return {
		id: newBlockId(),
		type: 'richText',
		props: {
			doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
		}
	};
}
function image(alt = ''): RawBlock {
	return { id: newBlockId(), type: 'image', props: { src: '/zine-sample.svg', alt } };
}
function element(block: RawBlock): RawElement {
	const def = allBlocks().find((candidate) => candidate.type === block.type);
	const track = def?.category === 'media' ? 'media' : 'content';
	return { id: newElementId(), track, block, range: { start: 0, end: 1 } };
}
function scene(type: SceneType, blocks: RawBlock[], label?: string): RawScene {
	return {
		id: newSceneId(),
		type,
		label,
		length: 'auto',
		beats: [{ id: newBeatId(), at: 0 }],
		elements: blocks.map(element)
	};
}
function story(scenes: RawScene[]): Record<string, unknown> {
	return {
		schemaVersion: 3,
		theme: {},
		acts: [{ id: newActId(), scenes }]
	};
}

export interface ZineTemplate {
	id: string;
	label: string;
	description: string;
	build: () => Record<string, unknown>;
}

export const ZINE_TEMPLATES: ZineTemplate[] = [
	{
		id: 'blank',
		label: 'Blank',
		description: 'A clean page to start from.',
		build: () =>
			story([
				scene('page', [heading('Your first scene'), paragraph('Start writing your zine here…')])
			])
	},
	{
		id: 'photo-essay',
		label: 'Photo essay',
		description: 'Let pictures lead the story.',
		build: () =>
			story([
				scene('feature', [image('Describe your cover picture')]),
				scene('page', [heading('A moment'), paragraph('Tell the story behind the picture…')])
			])
	},
	{
		id: 'data-story',
		label: 'Data story',
		description: 'Start with a question you want to answer.',
		build: () =>
			story([
				scene('page', [
					heading('What I wanted to know'),
					paragraph('My question is…'),
					paragraph('Why it matters…')
				]),
				scene(
					'page',
					[heading('Where my facts come from', 3), paragraph('List your sources here.')],
					'Sources'
				)
			])
	},
	{
		id: 'interview',
		label: 'Interview',
		description: 'Share a conversation.',
		build: () =>
			story([
				scene('page', [
					heading('In conversation with…'),
					paragraph('Introduce who you spoke to…'),
					paragraph('Q: Your first question?'),
					paragraph('A: Their answer…')
				])
			])
	}
];

export function buildTemplate(id: string): Record<string, unknown> {
	return (ZINE_TEMPLATES.find((t) => t.id === id) ?? ZINE_TEMPLATES[0]).build();
}
