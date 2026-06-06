// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { allBlocks } from '../registry';
import { seriousAxeViolations } from '../render/axe-helper';
import HeadingRender from './heading/Render.svelte';
import RichTextRender from './richText/Render.svelte';
import ImageRender from './image/Render.svelte';
import LinkButtonRender from './linkButton/Render.svelte';
import DividerRender from './divider/Render.svelte';
import SpacerRender from './spacer/Render.svelte';
import type { RichTextProps } from './richText/schema';

describe('core blocks', () => {
	it('every registered block renders its defaults with no serious axe violations', async () => {
		for (const def of allBlocks()) {
			const { container, unmount } = render(def.Render, { props: { props: def.defaults } });
			expect(container.innerHTML.trim().length, `${def.type} rendered empty`).toBeGreaterThan(0);
			expect(await seriousAxeViolations(container), def.type).toEqual([]);
			unmount();
		}
	});

	it('heading renders the requested semantic level', () => {
		const { container } = render(HeadingRender, { props: { props: { text: 'Hi', level: 3 } } });
		const h = container.querySelector('h3');
		expect(h?.textContent).toBe('Hi');
	});

	it('image renders its alt text', () => {
		const { container } = render(ImageRender, {
			props: { props: { src: '/x.svg', alt: 'A sleepy cat' } }
		});
		expect(container.querySelector('img')?.getAttribute('alt')).toBe('A sleepy cat');
	});

	it('rich text renders marks as safe semantic elements', () => {
		const doc: RichTextProps['doc'] = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
						{ type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
						{ type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
						{
							type: 'text',
							text: 'link',
							marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
						}
					]
				},
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'A field note' }]
				},
				{
					type: 'blockquote',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'The drain answers in inches.' }]
						}
					]
				}
			]
		};
		const { container } = render(RichTextRender, { props: { props: { doc } } });
		expect(container.querySelector('strong')?.textContent).toBe('bold');
		expect(container.querySelector('em')?.textContent).toBe('italic');
		expect(container.querySelector('u')?.textContent).toBe('underline');
		expect(container.querySelector('h2')?.textContent).toBe('A field note');
		expect(container.querySelector('blockquote')?.textContent).toContain('answers in inches');
		const a = container.querySelector('a');
		expect(a?.getAttribute('href')).toBe('https://example.com');
		expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('link/button renders an anchor (never a button element)', () => {
		const { container } = render(LinkButtonRender, {
			props: {
				props: { href: 'https://example.com', label: 'Go', variant: 'button', newTab: false }
			}
		});
		const a = container.querySelector('a');
		expect(a?.getAttribute('href')).toBe('https://example.com');
		expect(a?.textContent).toBe('Go');
		expect(container.querySelector('button')).toBeNull();
	});

	it('divider is an <hr> and spacer is decorative (aria-hidden)', () => {
		expect(
			render(DividerRender, { props: { props: {} } }).container.querySelector('hr')
		).toBeTruthy();
		const { container } = render(SpacerRender, { props: { props: { size: 'md' } } });
		expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
	});
});
