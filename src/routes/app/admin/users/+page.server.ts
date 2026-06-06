// People + roles. Admin-only (the area layout guards, and each action re-guards). Role writes
// go through the RLS client: the `users_update_self` policy + the `guard_user_role` trigger only
// permit an admin to change a role, so the database is the real gate.
import { fail } from '@sveltejs/kit';
import { requireRole } from '$lib/server/guards';
import type { AppRole } from '$lib/supabase/types';
import type { Actions, PageServerLoad } from './$types';

const ROLES: AppRole[] = ['student', 'teacher', 'admin'];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	if (!supabase) return { users: [] };
	const { data } = await supabase
		.from('users')
		.select('id, display_name, role, school_id, created_at')
		.order('role')
		.order('display_name');
	return { users: data ?? [] };
};

export const actions: Actions = {
	setRole: async (event) => {
		const admin = await requireRole(event, 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });

		const form = await event.request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = String(form.get('role') ?? '') as AppRole;
		if (!userId || !ROLES.includes(role)) return fail(400, { message: 'Pick a valid role.' });

		// Don't let an admin accidentally lock themselves out of the admin area.
		if (userId === admin.id && role !== 'admin') {
			return fail(400, { message: 'You can’t remove your own admin role here.' });
		}

		const { error } = await supabase.from('users').update({ role }).eq('id', userId);
		if (error) return fail(403, { message: error.message });
		return { ok: true, userId, role };
	}
};
