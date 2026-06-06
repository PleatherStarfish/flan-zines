// Classes overview for admins: every class with its teacher + roster size, and a delete.
// (Creating a class is a teacher action — see /app/teacher.) Admin RLS sees all rows.
import { fail } from '@sveltejs/kit';
import { requireRole } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	if (!supabase) return { classes: [] };
	const [{ data: classes }, { data: members }, { data: users }] = await Promise.all([
		supabase
			.from('classes')
			.select('id, name, join_code, teacher_id, created_at')
			.order('created_at'),
		supabase.from('class_members').select('class_id'),
		supabase.from('users').select('id, display_name')
	]);
	const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name]));
	const sizeById = new Map<string, number>();
	for (const m of members ?? []) sizeById.set(m.class_id, (sizeById.get(m.class_id) ?? 0) + 1);

	return {
		classes: (classes ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			joinCode: c.join_code,
			teacherName: nameById.get(c.teacher_id) ?? 'Unknown teacher',
			memberCount: sizeById.get(c.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	deleteClass: async (event) => {
		await requireRole(event, 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });
		const id = String((await event.request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Missing class id.' });
		const { error } = await supabase.from('classes').delete().eq('id', id);
		if (error) return fail(403, { message: error.message });
		return { ok: true };
	}
};
