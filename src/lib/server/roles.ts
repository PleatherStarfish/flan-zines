// Role helper. Reads the caller's profile via the RLS-scoped request client, so a
// user can only ever resolve their own row (the users_select policy enforces it).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '$lib/supabase/types';

export interface AppUser {
	id: string;
	role: AppRole;
	display_name: string | null;
	school_id: string | null;
}

/** Load the signed-in user's profile (role + pen name). Null if missing. */
export async function getAppUser(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<AppUser | null> {
	const { data } = await supabase
		.from('users')
		.select('id, role, display_name, school_id')
		.eq('id', userId)
		.maybeSingle();
	return data ?? null;
}

/** True when `user` holds one of `roles`. Authorization still lives in RLS — this
 *  is only for shaping the UI. */
export function hasRole(user: Pick<AppUser, 'role'> | null, ...roles: AppRole[]): boolean {
	return user !== null && roles.includes(user.role);
}
