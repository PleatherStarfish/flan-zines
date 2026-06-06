// The whole /app/admin area is admin-only. The guard 403s a non-admin; the RLS underneath is
// the real backstop (admin policies gate every row this area touches).
import { requireRole } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	await requireRole(event, 'admin');
	return {};
};
