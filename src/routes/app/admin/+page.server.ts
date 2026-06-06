// Admin overview: a few headline counts. Admin RLS sees every row, so these are studio-wide.
import type { PageServerLoad } from './$types';

type Counts = {
	users: number;
	classes: number;
	zines: number;
	reports: number;
	moderation: number;
};

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const empty: Counts = { users: 0, classes: 0, zines: 0, reports: 0, moderation: 0 };
	if (!supabase) return { counts: empty };

	// head:true → no rows transferred, just the exact count.
	const countOf = async (
		table: 'users' | 'classes' | 'zines' | 'reports' | 'moderation_items',
		filter?: [string, string]
	): Promise<number> => {
		let query = supabase.from(table).select('*', { count: 'exact', head: true });
		if (filter) query = query.eq(filter[0], filter[1]);
		const { count } = await query;
		return count ?? 0;
	};

	return {
		counts: {
			users: await countOf('users'),
			classes: await countOf('classes'),
			zines: await countOf('zines'),
			reports: await countOf('reports', ['status', 'open']),
			moderation: await countOf('moderation_items', ['status', 'pending'])
		}
	};
};
