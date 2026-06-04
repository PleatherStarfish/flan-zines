import { error } from '@sveltejs/kit';
import { DocumentError, parseDocument } from '$lib/zine/schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '$lib/zine/fixtures';
import type { PageLoad } from './$types';

// Step 2 renders a fixture document statically to prove the schema → renderer path.
// Per-zine loading from the published snapshot (by user + slug) arrives with the
// publish pipeline in Step 5.
export const load: PageLoad = ({ params }) => {
	try {
		const document = parseDocument(sampleZineRaw);
		return {
			document,
			title: sampleZineMeta.title,
			author: sampleZineMeta.author,
			user: params.user,
			slug: params.slug
		};
	} catch (e) {
		throw error(500, e instanceof DocumentError ? e.message : 'Failed to load zine.');
	}
};
