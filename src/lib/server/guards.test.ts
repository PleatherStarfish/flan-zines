import { describe, expect, it } from 'vitest';
import { requireRole, requireAbility } from './guards';
import type { AppRole } from '$lib/supabase/types';

// A minimal event whose `locals` resolves the given profile (or signed-out).
function eventFor(profile: { id: string; role: AppRole } | null) {
	const supabase = {
		from: () => ({
			select: () => ({
				eq: () => ({ maybeSingle: async () => ({ data: profile }) })
			})
		})
	};
	return {
		locals: {
			supabase: profile ? (supabase as never) : null,
			safeGetSession: async () => ({
				session: profile ? ({} as never) : null,
				user: profile ? ({ id: profile.id } as never) : null
			}),
			session: null,
			user: null
		}
	} as { locals: App.Locals };
}

const admin = eventFor({ id: 'a1', role: 'admin' });
const teacher = eventFor({ id: 't1', role: 'teacher' });
const student = eventFor({ id: 's1', role: 'student' });
const anon = eventFor(null);

describe('requireRole', () => {
	it('returns the profile for an allowed role', async () => {
		await expect(requireRole(admin, 'admin')).resolves.toMatchObject({ role: 'admin' });
		await expect(requireRole(teacher, 'teacher', 'admin')).resolves.toMatchObject({
			role: 'teacher'
		});
	});
	it('throws 403 for a disallowed role', async () => {
		await expect(requireRole(student, 'admin')).rejects.toMatchObject({ status: 403 });
		await expect(requireRole(teacher, 'admin')).rejects.toMatchObject({ status: 403 });
	});
	it('redirects to /login when signed out / no DB', async () => {
		await expect(requireRole(anon, 'admin')).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});
});

describe('requireAbility', () => {
	it('passes when the role has the ability', async () => {
		await expect(requireAbility(admin, 'manage', 'User')).resolves.toMatchObject({ role: 'admin' });
		await expect(requireAbility(teacher, 'moderate', 'Zine')).resolves.toMatchObject({
			role: 'teacher'
		});
	});
	it('throws 403 when it does not', async () => {
		await expect(requireAbility(student, 'moderate', 'Zine')).rejects.toMatchObject({
			status: 403
		});
		await expect(requireAbility(teacher, 'manage', 'School')).rejects.toMatchObject({
			status: 403
		});
	});
});
