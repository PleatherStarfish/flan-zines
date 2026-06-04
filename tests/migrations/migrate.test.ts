// Proves the migrations apply cleanly, enable RLS on every table, ship a policy
// per table, and are reversible (down → up on the same database).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, createPool, hasDb, resetDatabase, runDown } from '../db/harness';

const describeDb = hasDb ? describe : describe.skip;

const APP_TABLES = [
	'schools',
	'users',
	'classes',
	'class_members',
	'zines',
	'zine_drafts',
	'zine_versions',
	'assets',
	'moderation_items',
	'reports'
];

describeDb('migrations', () => {
	let pool: ReturnType<typeof createPool>;

	beforeAll(async () => {
		pool = createPool();
		await resetDatabase(pool);
	}, 60_000);

	afterAll(async () => {
		await pool?.end();
	});

	it('creates every application table', async () => {
		const { rows } = await pool.query<{ tablename: string }>(
			`select tablename from pg_tables where schemaname='public'`
		);
		const names = rows.map((r) => r.tablename);
		expect(names).toEqual(expect.arrayContaining(APP_TABLES));
	});

	it('enables RLS on every public table (deny-by-default)', async () => {
		const { rows } = await pool.query<{ relname: string }>(
			`select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`
		);
		expect(rows.map((r) => r.relname)).toEqual([]);
	});

	it('defines at least one RLS policy per table', async () => {
		const { rows } = await pool.query<{ tablename: string; n: string }>(
			`select tablename, count(*) as n from pg_policies where schemaname='public' group by tablename`
		);
		const byTable = new Map(rows.map((r) => [r.tablename, Number(r.n)]));
		for (const t of APP_TABLES) expect(byTable.get(t) ?? 0).toBeGreaterThan(0);
	});

	it('grants anon SELECT only on zines (narrow public surface)', async () => {
		const { rows } = await pool.query<{ table_name: string; privilege_type: string }>(
			`select table_name, privilege_type from information_schema.role_table_grants
       where grantee='anon' and table_schema='public'`
		);
		expect(rows).toEqual([{ table_name: 'zines', privilege_type: 'SELECT' }]);
	});

	it('is reversible: down.sql clears the schema and migrations re-apply', async () => {
		await runDown(pool);

		const stillThere = await pool.query<{ tablename: string }>(
			`select tablename from pg_tables where schemaname='public' and tablename = any($1)`,
			[APP_TABLES]
		);
		expect(stillThere.rows).toEqual([]);

		const typesGone = await pool.query<{ typname: string }>(
			`select typname from pg_type where typname in
         ('app_role','zine_status','asset_kind','moderation_status','report_status')`
		);
		expect(typesGone.rows).toEqual([]);

		// Re-apply forward migrations on the post-down database (shim still present).
		await applyMigrations(pool);
		const reapplied = await pool.query<{ tablename: string }>(
			`select tablename from pg_tables where schemaname='public' and tablename = any($1)`,
			[APP_TABLES]
		);
		expect(reapplied.rows.map((r) => r.tablename).sort()).toEqual([...APP_TABLES].sort());
	});
});
