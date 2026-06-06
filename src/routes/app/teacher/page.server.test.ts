import { describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';
import type { AppRole } from '$lib/supabase/types';

type Profile = {
	id: string;
	role: AppRole;
	display_name?: string | null;
	school_id?: string | null;
} | null;

function eventFor(
	profile: Profile,
	body: Record<string, string>,
	supabase: Record<string, unknown>
) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(body)) fd.set(k, v);

	const usersTable = {
		select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) })
	};

	return {
		request: { formData: async () => fd },
		locals: {
			supabase: profile
				? ({
						from: (table: string) => (table === 'users' ? usersTable : supabase[table])
					} as never)
				: null,
			safeGetSession: async () => ({
				session: profile ? {} : null,
				user: profile ? { id: profile.id } : null
			}),
			session: null,
			user: null
		}
	} as unknown;
}

describe('teacher classroom actions', () => {
	it('creates teacher-owned classes with a join code', async () => {
		let inserted: Record<string, unknown> | null = null;
		const supabase = {
			classes: {
				insert: (row: Record<string, unknown>) => {
					inserted = row;
					return {
						select: () => ({
							single: async () => ({
								data: { id: 'class-1', join_code: row.join_code },
								error: null
							})
						})
					};
				}
			}
		};

		const res = await actions.createClass(
			eventFor(
				{ id: 'teacher-1', role: 'teacher', school_id: 'school-1' },
				{ name: 'Period 3 Field Zines' },
				supabase
			) as Parameters<typeof actions.createClass>[0]
		);

		expect(res).toMatchObject({ ok: true, createdClassId: 'class-1' });
		expect(inserted).toMatchObject({
			teacher_id: 'teacher-1',
			school_id: 'school-1',
			name: 'Period 3 Field Zines'
		});
		expect(inserted).not.toBeNull();
		const row = inserted as unknown as Record<string, unknown>;
		expect(String(row.join_code)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
	});

	it('blocks teachers from resolving reports outside their rostered zines', async () => {
		const update = vi.fn();
		const supabase = {
			reports: {
				select: () => ({
					eq: () => ({ maybeSingle: async () => ({ data: { zine_id: 'zine-outside' } }) })
				}),
				update
			},
			zines: {
				select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) })
			}
		};

		const res = await actions.resolveReport(
			eventFor(
				{ id: 'teacher-1', role: 'teacher' },
				{ id: 'report-1', status: 'resolved' },
				supabase
			) as Parameters<typeof actions.resolveReport>[0]
		);

		expect(res).toMatchObject({ status: 403 });
		expect(update).not.toHaveBeenCalled();
	});

	it('lets teachers resolve reports for zines visible through classroom RLS', async () => {
		const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
		const supabase = {
			reports: {
				select: () => ({
					eq: () => ({ maybeSingle: async () => ({ data: { zine_id: 'zine-inside' } }) })
				}),
				update
			},
			zines: {
				select: () => ({
					eq: () => ({ maybeSingle: async () => ({ data: { id: 'zine-inside' } }) })
				})
			}
		};

		const res = await actions.resolveReport(
			eventFor(
				{ id: 'teacher-1', role: 'teacher' },
				{ id: 'report-1', status: 'resolved' },
				supabase
			) as Parameters<typeof actions.resolveReport>[0]
		);

		expect(res).toMatchObject({ ok: true });
		expect(update).toHaveBeenCalledWith({ status: 'resolved' });
	});
});
