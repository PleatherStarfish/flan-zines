// Safety queue: open reports + pending media awaiting moderation. Admin-only here; the same
// RLS (`reports_*`, `moderation_staff_all`) also lets teachers triage their own classes.
import { fail } from '@sveltejs/kit';
import { requireRole } from '$lib/server/guards';
import type { ModerationStatus, ReportStatus } from '$lib/supabase/types';
import type { Actions, PageServerLoad } from './$types';

const REPORT_STATUSES: ReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed'];
const ITEM_STATUSES: ModerationStatus[] = ['approved', 'rejected'];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	if (!supabase) return { reports: [], items: [] };
	const [reports, items] = await Promise.all([
		supabase
			.from('reports')
			.select('id, zine_id, reporter_id, reason, status, created_at')
			.in('status', ['open', 'reviewing'])
			.order('created_at'),
		supabase
			.from('moderation_items')
			.select('id, target_type, target_id, reason, status, created_at')
			.eq('status', 'pending')
			.order('created_at')
	]);
	return { reports: reports.data ?? [], items: items.data ?? [] };
};

export const actions: Actions = {
	resolveReport: async (event) => {
		await requireRole(event, 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '') as ReportStatus;
		if (!id || !REPORT_STATUSES.includes(status))
			return fail(400, { message: 'Invalid report update.' });
		const { error } = await supabase.from('reports').update({ status }).eq('id', id);
		if (error) return fail(403, { message: error.message });
		return { ok: true };
	},
	reviewItem: async (event) => {
		const admin = await requireRole(event, 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '') as ModerationStatus;
		if (!id || !ITEM_STATUSES.includes(status)) return fail(400, { message: 'Invalid review.' });

		const { data: item, error: itemError } = await supabase
			.from('moderation_items')
			.select('target_type, target_id')
			.eq('id', id)
			.maybeSingle();
		if (itemError || !item) {
			return fail(404, { message: itemError?.message ?? 'Could not find that moderation item.' });
		}

		if (item.target_type === 'asset') {
			const { error: assetError } = await supabase
				.from('assets')
				.update({ moderation_status: status })
				.eq('id', item.target_id);
			if (assetError) return fail(403, { message: assetError.message });
		}

		const { error } = await supabase
			.from('moderation_items')
			.update({ status, reviewed_by: admin.id })
			.eq('id', id);
		if (error) return fail(403, { message: error.message });
		return { ok: true };
	}
};
