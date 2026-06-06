// The teacher classroom area: teachers and admins only.
import { requireRole } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	await requireRole(event, 'teacher', 'admin');
	return {};
};
