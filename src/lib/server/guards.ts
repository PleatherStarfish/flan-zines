// Server-side route/action guards. These are defense-in-depth + a clean 403 for the UI; the
// Postgres RLS is the real enforcement (a request that slips past a guard still can't read or
// write rows it isn't entitled to). Used by `+layout.server.ts` / `+page.server.ts` loaders and
// form actions in the admin/teacher areas.
import { error, redirect } from '@sveltejs/kit';
import { getAppUser, type AppUser } from './roles';
import { defineAbilityFor, type Action, type Subject } from '$lib/auth/abilities';
import type { AppRole } from '$lib/supabase/types';

type GuardEvent = { locals: App.Locals };

/** The signed-in user's profile, or a redirect to /login (no session / no DB / no profile). */
async function requireProfile(event: GuardEvent): Promise<AppUser> {
	const { user } = await event.locals.safeGetSession();
	if (!user || !event.locals.supabase) throw redirect(303, '/login');
	const profile = await getAppUser(event.locals.supabase, user.id);
	if (!profile) throw redirect(303, '/login');
	return profile;
}

/** Require one of `roles`; otherwise 403. Returns the profile so the caller can reuse it. */
export async function requireRole(event: GuardEvent, ...roles: AppRole[]): Promise<AppUser> {
	const profile = await requireProfile(event);
	if (!roles.includes(profile.role)) {
		throw error(403, 'You don’t have access to this area.');
	}
	return profile;
}

/** Require the ability to `action` a `subject`; otherwise 403. */
export async function requireAbility(
	event: GuardEvent,
	action: Action,
	subject: Subject
): Promise<AppUser> {
	const profile = await requireProfile(event);
	if (!defineAbilityFor(profile).can(action, subject)) {
		throw error(403, 'You don’t have permission to do that.');
	}
	return profile;
}
