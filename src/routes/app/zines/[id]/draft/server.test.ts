import { describe, expect, it, vi } from 'vitest';
import { PUT } from './+server';

const validDocument = { schemaVersion: 7, acts: [] };

function eventWith(supabase: unknown, body: unknown): Parameters<typeof PUT>[0] {
	return {
		params: { id: 'z1' },
		request: new Request('http://localhost/app/zines/z1/draft', {
			method: 'PUT',
			body: JSON.stringify(body)
		}),
		locals: {
			supabase,
			safeGetSession: async () => ({
				session: { access_token: 'token' },
				user: { id: 'user_1' }
			})
		}
	} as Parameters<typeof PUT>[0];
}

function makeUpdateBuilder(rows: { updated_at: string }[]) {
	const predicates: Array<[string, unknown]> = [];
	const builder = {
		eq(column: string, value: unknown) {
			predicates.push([column, value]);
			return builder;
		},
		async select(_columns: string) {
			return { data: rows, error: null };
		}
	};
	return { builder, predicates };
}

function makeCurrentBuilder(updatedAt: string | null) {
	const builder = {
		select(_columns: string) {
			return builder;
		},
		eq(_column: string, _value: unknown) {
			return builder;
		},
		async maybeSingle() {
			return { data: updatedAt ? { updated_at: updatedAt } : null, error: null };
		}
	};
	return builder;
}

describe('draft autosave endpoint', () => {
	it('updates atomically with the client base updated_at token', async () => {
		const update = makeUpdateBuilder([{ updated_at: 'srv-2' }]);
		const supabase = {
			from: vi.fn((_table: string) => ({
				update: vi.fn((_value: unknown) => update.builder)
			}))
		};

		const response = await PUT(
			eventWith(supabase, { document: validDocument, baseUpdatedAt: 'srv-1', clientRev: 3 })
		);

		expect(response.status).toBe(200);
		expect(update.predicates).toContainEqual(['zine_id', 'z1']);
		expect(update.predicates).toContainEqual(['updated_at', 'srv-1']);
	});

	it('returns 409 when the atomic update finds a newer draft', async () => {
		const update = makeUpdateBuilder([]);
		let call = 0;
		const supabase = {
			from: vi.fn((_table: string) => {
				call += 1;
				if (call === 1) {
					return { update: vi.fn((_value: unknown) => update.builder) };
				}
				return makeCurrentBuilder('srv-2');
			})
		};

		const response = await PUT(
			eventWith(supabase, { document: validDocument, baseUpdatedAt: 'srv-1', clientRev: 3 })
		);
		const body = (await response.json()) as { conflict: boolean; serverUpdatedAt: string };

		expect(response.status).toBe(409);
		expect(body).toEqual({ conflict: true, serverUpdatedAt: 'srv-2' });
	});

	it('rejects malformed save payloads before touching the database', async () => {
		const supabase = { from: vi.fn() };

		await expect(
			PUT(eventWith(supabase, { baseUpdatedAt: 'srv-1', clientRev: 3 }))
		).rejects.toMatchObject({ status: 400 });
		expect(supabase.from).not.toHaveBeenCalled();
	});
});
