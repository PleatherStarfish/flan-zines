import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { DocumentError, parseDocument } from '$lib/zine/schema/migrate';
import type { Json } from '$lib/supabase/types';
import type { RequestHandler } from './$types';

const DraftPutBodySchema = z.object({
	document: z.unknown().refine((value) => value !== undefined, 'document is required.'),
	baseUpdatedAt: z.string().min(1).nullable(),
	clientRev: z.number().int().nonnegative()
});

// Autosave target (editor.md §7). Validates the document server-side BEFORE writing,
// uses zine_drafts.updated_at as an optimistic-concurrency token (409 on drift, never
// auto-overwrite), and writes only through the RLS-scoped client (owner-only).
export const PUT: RequestHandler = async ({
	params,
	request,
	locals: { supabase, safeGetSession }
}) => {
	const { session, user } = await safeGetSession();
	if (!supabase || !session || !user) throw error(401, 'You must be signed in to save.');

	let body: z.infer<typeof DraftPutBodySchema>;
	try {
		body = DraftPutBodySchema.parse(await request.json());
	} catch (e) {
		throw error(400, e instanceof z.ZodError ? z.prettifyError(e) : 'Invalid request body.');
	}

	let document;
	try {
		document = parseDocument(body.document);
	} catch (e) {
		throw error(400, e instanceof DocumentError ? e.message : 'Invalid document.');
	}

	const updatedAt = new Date().toISOString();

	if (body.baseUpdatedAt === null) {
		const { error: insertError } = await supabase
			.from('zine_drafts')
			.insert({ zine_id: params.id, document: document as unknown as Json, updated_at: updatedAt });
		if (!insertError) return json({ clientRev: body.clientRev, updatedAt });

		const conflict = await fetchCurrentDraftToken(supabase, params.id);
		if (conflict) {
			return json({ conflict: true, serverUpdatedAt: conflict.updated_at }, { status: 409 });
		}
		throw error(403, insertError.message);
	}

	const { data: updatedRows, error: updateError } = await supabase
		.from('zine_drafts')
		.update({ document: document as unknown as Json, updated_at: updatedAt })
		.eq('zine_id', params.id)
		.eq('updated_at', body.baseUpdatedAt)
		.select('updated_at');
	if (updateError) throw error(403, updateError.message);

	if ((updatedRows ?? []).length === 0) {
		const conflict = await fetchCurrentDraftToken(supabase, params.id);
		if (conflict) {
			return json({ conflict: true, serverUpdatedAt: conflict.updated_at }, { status: 409 });
		}
		throw error(404, 'Draft not found.');
	}

	return json({ clientRev: body.clientRev, updatedAt });
};

async function fetchCurrentDraftToken(
	supabase: NonNullable<Parameters<RequestHandler>[0]['locals']['supabase']>,
	zineId: string
): Promise<{ updated_at: string } | null> {
	const { data, error: dbError } = await supabase
		.from('zine_drafts')
		.select('updated_at')
		.eq('zine_id', zineId)
		.maybeSingle();
	if (dbError) throw error(403, dbError.message);
	return data;
}
