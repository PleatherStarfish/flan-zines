// The teacher's classroom: their classes, the roster of EACH class, and per student their zines +
// any media awaiting moderation. Only ROSTERED students appear — a student's personal account
// (not in any class) is never surfaced here, which is the "separate accounts" model. RLS is the
// backstop: `is_class_teacher`/`is_teacher_of` mean these queries can only ever return the
// caller's own students.
import { fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { requireRole } from '$lib/server/guards';
import type { ModerationStatus, ReportStatus } from '$lib/supabase/types';
import type { Actions, PageServerLoad } from './$types';

const ITEM_STATUSES: ModerationStatus[] = ['approved', 'rejected'];
const REPORT_STATUSES: ReportStatus[] = ['reviewing', 'resolved', 'dismissed'];
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeJoinCode(): string {
	const values = randomBytes(6);
	return Array.from(values, (value) => JOIN_CODE_ALPHABET[value % JOIN_CODE_ALPHABET.length]).join(
		''
	);
}

async function canTeacherReviewReport(
	supabase: NonNullable<App.Locals['supabase']>,
	reportId: string
): Promise<boolean> {
	const { data: report } = await supabase
		.from('reports')
		.select('zine_id')
		.eq('id', reportId)
		.maybeSingle();
	if (!report?.zine_id) return false;

	// zines RLS is narrower than reports RLS: a teacher can read only their own students' zines.
	const { data: zine } = await supabase
		.from('zines')
		.select('id')
		.eq('id', report.zine_id)
		.maybeSingle();
	return Boolean(zine);
}

export const load: PageServerLoad = async (event) => {
	const profile = await requireRole(event, 'teacher', 'admin');
	const { supabase } = event.locals;
	if (!supabase) return { classes: [], reports: [] };

	const { data: classes } = await supabase
		.from('classes')
		.select('id, name, join_code')
		.eq('teacher_id', profile.id)
		.order('created_at');
	const classIds = (classes ?? []).map((c) => c.id);
	if (classIds.length === 0) return { classes: [], reports: [] };

	const { data: memberships } = await supabase
		.from('class_members')
		.select('class_id, student_id')
		.in('class_id', classIds);
	const studentIds = [...new Set((memberships ?? []).map((m) => m.student_id))];

	const [studentsRes, zinesRes, assetsRes] = await Promise.all([
		studentIds.length
			? supabase.from('users').select('id, display_name').in('id', studentIds)
			: Promise.resolve({ data: [] }),
		studentIds.length
			? supabase
					.from('zines')
					.select('id, owner_id, title, status, updated_at')
					.in('owner_id', studentIds)
					.order('updated_at', { ascending: false })
			: Promise.resolve({ data: [] }),
		studentIds.length
			? supabase
					.from('assets')
					.select('id, owner_id, kind, alt')
					.in('owner_id', studentIds)
					.eq('moderation_status', 'pending')
			: Promise.resolve({ data: [] })
	]);
	const students = studentsRes.data ?? [];
	const zines = zinesRes.data ?? [];
	const pendingAssets = assetsRes.data ?? [];

	const nameById = new Map(students.map((s) => [s.id, s.display_name]));
	const byStudent = (sid: string) => ({
		id: sid,
		name: nameById.get(sid) ?? 'Student',
		zines: zines.filter((z) => z.owner_id === sid),
		pendingAssets: pendingAssets.filter((a) => a.owner_id === sid)
	});
	const rosterByClass = new Map<string, string[]>();
	for (const m of memberships ?? []) {
		rosterByClass.set(m.class_id, [...(rosterByClass.get(m.class_id) ?? []), m.student_id]);
	}

	// Reports about this teacher's students' zines (the broad reports RLS is narrowed here).
	const zineIds = zines.map((z) => z.id);
	const { data: reports } = zineIds.length
		? await supabase
				.from('reports')
				.select('id, zine_id, reason, status')
				.in('zine_id', zineIds)
				.in('status', ['open', 'reviewing'])
		: { data: [] };

	return {
		classes: (classes ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			joinCode: c.join_code,
			students: (rosterByClass.get(c.id) ?? []).map(byStudent)
		})),
		reports: reports ?? []
	};
};

export const actions: Actions = {
	createClass: async (event) => {
		const teacher = await requireRole(event, 'teacher', 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });

		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length < 2) return fail(400, { message: 'Give the class a short name.' });
		if (name.length > 80)
			return fail(400, { message: 'Class names should stay under 80 characters.' });

		for (let attempt = 0; attempt < 5; attempt += 1) {
			const join_code = makeJoinCode();
			const { data, error } = await supabase
				.from('classes')
				.insert({
					teacher_id: teacher.id,
					school_id: teacher.school_id,
					name,
					join_code
				})
				.select('id, join_code')
				.single();

			if (!error && data) return { ok: true, createdClassId: data.id, joinCode: data.join_code };
			if (!error?.message.toLowerCase().includes('duplicate')) {
				return fail(403, { message: error?.message ?? 'Could not create the class.' });
			}
		}

		return fail(500, { message: 'Could not make a unique join code. Try again.' });
	},
	moderateAsset: async (event) => {
		await requireRole(event, 'teacher', 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '') as ModerationStatus;
		if (!id || !ITEM_STATUSES.includes(status)) return fail(400, { message: 'Invalid review.' });
		// RLS + guard_asset_moderation: only the student's teacher (or admin) may change this.
		const { error } = await supabase
			.from('assets')
			.update({ moderation_status: status })
			.eq('id', id);
		if (error) return fail(403, { message: error.message });
		return { ok: true };
	},
	resolveReport: async (event) => {
		const reviewer = await requireRole(event, 'teacher', 'admin');
		const { supabase } = event.locals;
		if (!supabase) return fail(503, { message: 'The database is unavailable.' });
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '') as ReportStatus;
		if (!id || !REPORT_STATUSES.includes(status)) return fail(400, { message: 'Invalid update.' });
		if (reviewer.role !== 'admin' && !(await canTeacherReviewReport(supabase, id))) {
			return fail(403, { message: 'That report is outside your classroom.' });
		}
		const { error } = await supabase.from('reports').update({ status }).eq('id', id);
		if (error) return fail(403, { message: error.message });
		return { ok: true };
	}
};
