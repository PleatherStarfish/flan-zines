// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { parseDocument } from '../schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '../fixtures';

function renderFixture() {
	const document = parseDocument(sampleZineRaw);
	return render(ZineRenderer, { props: { document, title: sampleZineMeta.title } });
}

describe('ZineRenderer', () => {
	it('renders the title as the single h1 plus semantic content from every block', () => {
		const { container } = renderFixture();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(container.querySelector('h1')?.textContent).toBe(sampleZineMeta.title);
		expect(container.querySelector('h2')).toBeTruthy();
		expect(container.querySelector('h3')).toBeTruthy();
		expect(container.querySelector('hr')).toBeTruthy();
		expect(container.querySelector('ul')).toBeTruthy();
		expect(container.querySelector('strong')).toBeTruthy();
		expect(container.querySelector('em')).toBeTruthy();
		expect(container.querySelector('img')?.getAttribute('alt')).toBeTruthy();
		expect(container.querySelector('a[href="https://pudding.cool"]')).toBeTruthy();
	});

	it('produces a valid heading outline (starts at h1, never skips a level)', () => {
		const { container } = renderFixture();
		const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
			Number(h.tagName[1])
		);
		expect(levels[0]).toBe(1);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
		}
	});

	it('has no critical or serious axe violations', async () => {
		const { container } = renderFixture();
		expect(await seriousAxeViolations(container)).toEqual([]);
	});
});
