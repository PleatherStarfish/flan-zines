import { describe, expect, it } from 'vitest';
import { actions } from './+page.server';
import type { AppRole } from '$lib/supabase/types';

type Profile = { id: string; role: AppRole } | null;

// Mock event: getAppUser reads users via select().eq().maybeSingle(); the action writes via
// update().eq(). One `from('users')` mock serves both.
function eventFor(
	profile: Profile,
	body: Record<string, string>,
	updateError: { message: string } | null = null
) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(body)) fd.set(k, v);
	const usersTable = {
		select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
		update: () => ({ eq: async () => ({ error: updateError }) })
	};
	return {
		request: { formData: async () => fd },
		locals: {
			supabase: profile ? { from: () => usersTable } : null,
			safeGetSession: async () => ({
				session: profile ? {} : null,
				user: profile ? { id: profile.id } : null
			}),
			session: null,
			user: null
		}
	} as unknown as Parameters<typeof actions.setRole>[0];
}

describe('admin users — setRole action', () => {
	it('lets an admin change another user’s role', async () => {
		const res = await actions.setRole(
			eventFor({ id: 'a1', role: 'admin' }, { userId: 's1', role: 'teacher' })
		);
		expect(res).toMatchObject({ ok: true, role: 'teacher' });
	});

	it('blocks a non-admin with 403 (the guard, before any write)', async () => {
		await expect(
			actions.setRole(eventFor({ id: 's1', role: 'student' }, { userId: 's2', role: 'admin' }))
		).rejects.toMatchObject({ status: 403 });
		await expect(
			actions.setRole(eventFor({ id: 't1', role: 'teacher' }, { userId: 's2', role: 'admin' }))
		).rejects.toMatchObject({ status: 403 });
	});

	it('refuses to strip the acting admin’s own role (no self-lockout)', async () => {
		const res = await actions.setRole(
			eventFor({ id: 'a1', role: 'admin' }, { userId: 'a1', role: 'student' })
		);
		expect(res).toMatchObject({ status: 400 });
	});

	it('rejects an invalid role', async () => {
		const res = await actions.setRole(
			eventFor({ id: 'a1', role: 'admin' }, { userId: 's1', role: 'wizard' })
		);
		expect(res).toMatchObject({ status: 400 });
	});
});
