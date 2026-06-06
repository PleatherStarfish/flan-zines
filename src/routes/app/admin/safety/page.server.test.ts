import { describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';

function eventFor(body: Record<string, string>, supabase: Record<string, unknown>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(body)) fd.set(k, v);

	const admin = { id: 'admin-1', role: 'admin' };
	const usersTable = {
		select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: admin }) }) })
	};

	return {
		request: { formData: async () => fd },
		locals: {
			supabase: {
				from: (table: string) => (table === 'users' ? usersTable : supabase[table])
			},
			safeGetSession: async () => ({
				session: {},
				user: { id: admin.id }
			}),
			session: null,
			user: null
		}
	} as unknown as Parameters<typeof actions.reviewItem>[0];
}

describe('admin safety actions', () => {
	it('updates an asset target before resolving its moderation queue row', async () => {
		const updateAsset = vi.fn(() => ({ eq: async () => ({ error: null }) }));
		const updateItem = vi.fn(() => ({ eq: async () => ({ error: null }) }));

		const supabase = {
			moderation_items: {
				select: () => ({
					eq: () => ({
						maybeSingle: async () => ({
							data: { target_type: 'asset', target_id: 'asset-1' },
							error: null
						})
					})
				}),
				update: updateItem
			},
			assets: {
				update: updateAsset
			}
		};

		const res = await actions.reviewItem(eventFor({ id: 'item-1', status: 'approved' }, supabase));

		expect(res).toMatchObject({ ok: true });
		expect(updateAsset).toHaveBeenCalledWith({ moderation_status: 'approved' });
		expect(updateItem).toHaveBeenCalledWith({ status: 'approved', reviewed_by: 'admin-1' });
	});

	it('keeps the moderation row pending if the target asset update fails', async () => {
		const updateItem = vi.fn();
		const supabase = {
			moderation_items: {
				select: () => ({
					eq: () => ({
						maybeSingle: async () => ({
							data: { target_type: 'asset', target_id: 'asset-1' },
							error: null
						})
					})
				}),
				update: updateItem
			},
			assets: {
				update: () => ({ eq: async () => ({ error: { message: 'Asset update failed' } }) })
			}
		};

		const res = await actions.reviewItem(eventFor({ id: 'item-1', status: 'rejected' }, supabase));

		expect(res).toMatchObject({ status: 403 });
		expect(updateItem).not.toHaveBeenCalled();
	});
});
