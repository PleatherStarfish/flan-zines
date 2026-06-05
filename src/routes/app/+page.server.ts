// "My Zines". RLS already restricts drafts to their owner; the explicit owner_id
// filter makes the intent clear and keeps the query a single index lookup.
import { fail, redirect } from '@sveltejs/kit';
import { buildTemplate } from '$lib/editor/templates';
import { parseDocument } from '$lib/zine/schema/migrate';
import type { Json } from '$lib/supabase/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!supabase || !user) return { zines: [] };

	const { data } = await supabase
		.from('zines')
		.select('id, title, slug, status, updated_at')
		.eq('owner_id', user.id)
		.order('updated_at', { ascending: false });

	return { zines: data ?? [] };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!supabase || !user) return fail(401, { message: 'Please sign in.' });

		const form = await request.formData();
		const templateId = String(form.get('template') ?? 'blank');
		const title = String(form.get('title') ?? '').trim() || 'Untitled zine';

		let document;
		try {
			document = parseDocument(buildTemplate(templateId));
		} catch {
			return fail(500, { message: 'That template could not be created.' });
		}

		// RLS: owner_id must equal auth.uid(); the draft insert needs can_edit_zine.
		const { data: zine, error: zineError } = await supabase
			.from('zines')
			.insert({ owner_id: user.id, title })
			.select('id')
			.single();
		if (zineError || !zine)
			return fail(403, { message: zineError?.message ?? 'Could not create the zine.' });

		const { error: draftError } = await supabase
			.from('zine_drafts')
			.insert({ zine_id: zine.id, document: document as unknown as Json });
		if (draftError) return fail(403, { message: draftError.message });

		throw redirect(303, `/app/zines/${zine.id}/edit`);
	}
};
