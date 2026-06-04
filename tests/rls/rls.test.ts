// Proves the Row-Level Security policies enforce ownership at the DATABASE — not
// just in the UI. Each test impersonates a real seeded user and asserts what they
// can and cannot see/do. Skips automatically when no test database is configured.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asActor, countAs, createPool, hasDb, IDS, resetDatabase } from '../db/harness';

const describeDb = hasDb ? describe : describe.skip;

describeDb('RLS — ownership is enforced at the database', () => {
	let pool: ReturnType<typeof createPool>;

	beforeAll(async () => {
		pool = createPool();
		await resetDatabase(pool);
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
	});

	const auth = (sub: string) => ({ sub, role: 'authenticated' as const });
	const anon = { role: 'anon' as const };

	describe('zine_drafts — the private working document', () => {
		it('denies a peer reading another student’s draft (both directions)', async () => {
			expect(
				await countAs(pool, auth(IDS.inkwell), 'select 1 from zine_drafts where zine_id=$1', [
					IDS.draftZineRiver
				])
			).toBe(0);
			expect(
				await countAs(pool, auth(IDS.river), 'select 1 from zine_drafts where zine_id=$1', [
					IDS.draftZineInkwell
				])
			).toBe(0);
		});

		it('denies an unrelated student in a different class', async () => {
			expect(
				await countAs(pool, auth(IDS.marigold), 'select 1 from zine_drafts where zine_id=$1', [
					IDS.draftZineRiver
				])
			).toBe(0);
		});

		it('lets the owner read and write their own draft', async () => {
			expect(
				await countAs(pool, auth(IDS.river), 'select 1 from zine_drafts where zine_id=$1', [
					IDS.draftZineRiver
				])
			).toBe(1);
			const updated = await asActor(pool, auth(IDS.river), (q) =>
				q('update zine_drafts set document=$2 where zine_id=$1', [
					IDS.draftZineRiver,
					{ edited: true }
				])
			);
			expect(updated.rowCount).toBe(1);
		});

		it('lets the owner’s teacher read the draft', async () => {
			expect(
				await countAs(pool, auth(IDS.teacher), 'select 1 from zine_drafts where zine_id=$1', [
					IDS.draftZineRiver
				])
			).toBe(1);
		});

		it('denies a peer WRITING another draft (update affects zero rows)', async () => {
			const res = await asActor(pool, auth(IDS.inkwell), (q) =>
				q('update zine_drafts set document=$2 where zine_id=$1', [
					IDS.draftZineRiver,
					{ hacked: true }
				])
			);
			expect(res.rowCount).toBe(0);
			// and the document is untouched when the owner looks
			const doc = await asActor(pool, auth(IDS.river), (q) =>
				q<{ document: unknown }>('select document from zine_drafts where zine_id=$1', [
					IDS.draftZineRiver
				])
			);
			expect(doc.rows[0].document).not.toMatchObject({ hacked: true });
		});

		it('denies anon any access to drafts (no table privilege)', async () => {
			await expect(asActor(pool, anon, (q) => q('select 1 from zine_drafts'))).rejects.toThrow(
				/permission denied/i
			);
		});
	});

	describe('zines — draft hidden, published public', () => {
		it('shows peers only the published zine, never the draft', async () => {
			const rows = await asActor(pool, auth(IDS.inkwell), (q) =>
				q<{ id: string }>('select id from zines where owner_id=$1', [IDS.river])
			);
			expect(rows.rows.map((r) => r.id)).toEqual([IDS.publishedZineRiver]);
		});

		it('lets anon read a published zine but not a draft zine', async () => {
			expect(
				await countAs(pool, anon, 'select 1 from zines where id=$1', [IDS.publishedZineRiver])
			).toBe(1);
			expect(
				await countAs(pool, anon, 'select 1 from zines where id=$1', [IDS.draftZineRiver])
			).toBe(0);
		});

		it('forbids creating a zine owned by someone else', async () => {
			await expect(
				asActor(pool, auth(IDS.inkwell), (q) =>
					q('insert into zines (owner_id, title) values ($1, $2)', [IDS.river, 'Forged'])
				)
			).rejects.toThrow(/row-level security/i);
		});
	});

	describe('users — profiles and role escalation', () => {
		it('prevents a student from escalating their own role', async () => {
			await expect(
				asActor(pool, auth(IDS.river), (q) =>
					q("update users set role='admin' where id=$1", [IDS.river])
				)
			).rejects.toThrow(/change a user role/i);
		});

		it('hides peer profiles but shows self and the teacher’s students', async () => {
			expect(
				await countAs(pool, auth(IDS.inkwell), 'select 1 from users where id=$1', [IDS.river])
			).toBe(0);
			expect(
				await countAs(pool, auth(IDS.inkwell), 'select 1 from users where id=$1', [IDS.inkwell])
			).toBe(1);
			expect(
				await countAs(pool, auth(IDS.teacher), 'select 1 from users where id=$1', [IDS.river])
			).toBe(1);
		});
	});

	describe('zine_versions — immutable snapshots', () => {
		it('cannot be mutated (no UPDATE policy exists)', async () => {
			const res = await asActor(pool, auth(IDS.river), (q) =>
				q('update zine_versions set label=$2 where id=$1', [IDS.versionRiver, 'tampered'])
			);
			expect(res.rowCount).toBe(0);
		});

		it('is hidden from peers', async () => {
			expect(
				await countAs(pool, auth(IDS.inkwell), 'select 1 from zine_versions where id=$1', [
					IDS.versionRiver
				])
			).toBe(0);
		});
	});

	describe('assets — moderation cannot be self-approved', () => {
		it('prevents a student approving their own asset', async () => {
			await expect(
				asActor(pool, auth(IDS.river), (q) =>
					q("update assets set moderation_status='approved' where id=$1", [IDS.assetRiver])
				)
			).rejects.toThrow(/moderation status/i);
		});

		it('lets the teacher approve it', async () => {
			const res = await asActor(pool, auth(IDS.teacher), (q) =>
				q("update assets set moderation_status='approved' where id=$1", [IDS.assetRiver])
			);
			expect(res.rowCount).toBe(1);
		});

		it('hides assets from peers', async () => {
			expect(
				await countAs(pool, auth(IDS.inkwell), 'select 1 from assets where id=$1', [IDS.assetRiver])
			).toBe(0);
		});
	});

	describe('moderation_items — staff only', () => {
		it('denies students any visibility', async () => {
			expect(await countAs(pool, auth(IDS.inkwell), 'select 1 from moderation_items')).toBe(0);
		});

		it('lets the teacher see the queue', async () => {
			expect(
				await countAs(pool, auth(IDS.teacher), 'select 1 from moderation_items')
			).toBeGreaterThan(0);
		});
	});

	describe('reports — filer identity is enforced', () => {
		it('lets a student file under their own identity but not impersonate another', async () => {
			const ok = await asActor(pool, auth(IDS.marigold), (q) =>
				q('insert into reports (zine_id, reporter_id, reason) values ($1,$2,$3)', [
					IDS.publishedZineRiver,
					IDS.marigold,
					'typo'
				])
			);
			expect(ok.rowCount).toBe(1);
			await expect(
				asActor(pool, auth(IDS.marigold), (q) =>
					q('insert into reports (zine_id, reporter_id, reason) values ($1,$2,$3)', [
						IDS.publishedZineRiver,
						IDS.river,
						'forged'
					])
				)
			).rejects.toThrow(/row-level security/i);
		});

		it('shows reporters only their own reports; peers see none', async () => {
			expect(await countAs(pool, auth(IDS.marigold), 'select 1 from reports')).toBeGreaterThan(0);
			expect(await countAs(pool, auth(IDS.inkwell), 'select 1 from reports')).toBe(0);
		});
	});

	describe('classes — teacher owns, members read, outsiders denied', () => {
		it('hides a class from a non-member student', async () => {
			expect(
				await countAs(pool, auth(IDS.marigold), 'select 1 from classes where id=$1', [IDS.class])
			).toBe(0);
		});

		it('lets a member and the teacher read the class', async () => {
			expect(
				await countAs(pool, auth(IDS.river), 'select 1 from classes where id=$1', [IDS.class])
			).toBe(1);
			expect(
				await countAs(pool, auth(IDS.teacher), 'select 1 from classes where id=$1', [IDS.class])
			).toBe(1);
		});

		it('forbids a student creating a class', async () => {
			await expect(
				asActor(pool, auth(IDS.river), (q) =>
					q('insert into classes (teacher_id, name, join_code) values ($1,$2,$3)', [
						IDS.river,
						'Rogue class',
						'ROGUE1'
					])
				)
			).rejects.toThrow(/row-level security/i);
		});
	});

	describe('class_members — roster is managed by the teacher', () => {
		it('forbids a student enrolling themselves (no self-join until Step 6)', async () => {
			await expect(
				asActor(pool, auth(IDS.marigold), (q) =>
					q('insert into class_members (class_id, student_id) values ($1,$2)', [
						IDS.class,
						IDS.marigold
					])
				)
			).rejects.toThrow(/row-level security/i);
		});

		it('lets the class teacher add a student', async () => {
			const res = await asActor(pool, auth(IDS.teacher), (q) =>
				q('insert into class_members (class_id, student_id) values ($1,$2)', [
					IDS.class,
					IDS.marigold
				])
			);
			expect(res.rowCount).toBe(1);
		});
	});

	describe('schools — readable by members, writable only by admins', () => {
		it('lets a signed-in student read schools but not modify them', async () => {
			expect(
				await countAs(pool, auth(IDS.river), 'select 1 from schools where id=$1', [IDS.school])
			).toBe(1);
			await expect(
				asActor(pool, auth(IDS.river), (q) =>
					q('insert into schools (name) values ($1)', ['Rogue School'])
				)
			).rejects.toThrow(/row-level security/i);
		});

		it('denies anon any access to schools', async () => {
			await expect(asActor(pool, anon, (q) => q('select 1 from schools'))).rejects.toThrow(
				/permission denied/i
			);
		});
	});

	describe('service_role — server-side bypass', () => {
		it('can read every draft (RLS bypassed for the server)', async () => {
			const res = await asActor(pool, { role: 'service_role' }, (q) =>
				q('select count(*)::int as n from zine_drafts')
			);
			expect((res.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(3);
		});
	});
});
