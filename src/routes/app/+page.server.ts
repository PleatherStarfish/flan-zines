// "My Zines". RLS already restricts drafts to their owner; the explicit owner_id
// filter makes the intent clear and keeps the query a single index lookup.
import type { PageServerLoad } from './$types';

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
