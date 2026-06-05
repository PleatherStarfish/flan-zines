import { error, redirect } from '@sveltejs/kit';
import { parseDocument } from '$lib/zine/schema/migrate';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) throw redirect(303, '/login');
	if (!supabase) throw error(503, 'The backend is not configured.');

	// RLS restricts both reads to the owner (+ their teacher / admin).
	const { data: zine } = await supabase
		.from('zines')
		.select('id, title, status')
		.eq('id', params.id)
		.maybeSingle();
	if (!zine) throw error(404, 'Zine not found.');

	const { data: draft } = await supabase
		.from('zine_drafts')
		.select('document, updated_at')
		.eq('zine_id', params.id)
		.maybeSingle();
	if (!draft) throw error(404, 'This zine has no draft to edit.');

	try {
		const document = parseDocument(draft.document);
		return { zine, document, baseUpdatedAt: draft.updated_at };
	} catch {
		// Failed migrate/parse must NOT overwrite the saved work. Surface a safe error;
		// a full read-only recovery screen (editor.md §7.7) is a follow-up.
		throw error(500, 'This draft could not be opened. Your saved work is safe and untouched.');
	}
};
