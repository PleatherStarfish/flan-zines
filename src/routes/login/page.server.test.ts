import { describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';

function eventFor(persona: string) {
	const fd = new FormData();
	fd.set('persona', persona);
	const signInWithPassword = vi.fn(async () => ({ error: null }));

	return {
		request: { formData: async () => fd },
		locals: {
			supabase: { auth: { signInWithPassword } }
		},
		signInWithPassword
	} as unknown as Parameters<typeof actions.devlogin>[0] & {
		signInWithPassword: typeof signInWithPassword;
	};
}

describe('dev login action', () => {
	it('signs in as the seeded teacher and redirects to the classroom dashboard', async () => {
		const event = eventFor('teacher');

		await expect(actions.devlogin(event)).rejects.toMatchObject({
			status: 303,
			location: '/app/teacher'
		});
		expect(event.signInWithPassword).toHaveBeenCalledWith({
			email: 'quill@lakeside.test',
			password: 'password123'
		});
	});

	it('keeps the seeded student login on the zine shelf', async () => {
		const event = eventFor('student');

		await expect(actions.devlogin(event)).rejects.toMatchObject({
			status: 303,
			location: '/app'
		});
		expect(event.signInWithPassword).toHaveBeenCalledWith({
			email: 'river@lakeside.test',
			password: 'password123'
		});
	});
});
