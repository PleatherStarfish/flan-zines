import axe from 'axe-core';

// Component-level accessibility check (jsdom + @testing-library/svelte). Runs axe on
// a mounted node and returns critical/serious violations (empty = pass). We set a
// document lang + title so page-scope rules don't false-positive on the bare jsdom
// document, and disable color-contrast (jsdom has no layout engine to measure it).
// Full page-level + contrast audits run via Playwright in Step 6.
export async function seriousAxeViolations(node: Element): Promise<string[]> {
	if (!document.documentElement.lang) document.documentElement.lang = 'en';
	if (!document.title) document.title = 'a11y test';

	const results = await axe.run(node, {
		resultTypes: ['violations'],
		rules: { 'color-contrast': { enabled: false } }
	});

	return results.violations
		.filter((v) => v.impact === 'critical' || v.impact === 'serious')
		.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
}
