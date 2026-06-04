// Docker-free database test harness.
//
// Applies the Supabase shim + real migrations + seed to a plain Postgres, then
// lets a test act AS a given user (role + JWT `sub`) exactly the way PostgREST
// does — so the Row-Level Security policies are exercised for real, not mocked.
//
// Point it at a database with SUPABASE_DB_URL (or DATABASE_URL). When neither is
// set, `hasDb` is false and the DB suites skip, keeping `pnpm test` green for
// contributors without a local Postgres (CI always provides one).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import type { PoolClient } from 'pg';

const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;
export type Query = PoolClient['query'];

export const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? '';
export const hasDb = DB_URL.length > 0;

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// Seed UUIDs (mirror supabase/seed.sql) so tests read like the story they prove.
export const IDS = {
	school: '00000000-0000-0000-0000-0000000005c1',
	teacher: '00000000-0000-0000-0000-00000000a001', // Ms. Quill
	river: '00000000-0000-0000-0000-00000000a101', // student, in class (owner)
	inkwell: '00000000-0000-0000-0000-00000000a102', // student, same class (peer)
	marigold: '00000000-0000-0000-0000-00000000a103', // student, NOT in class
	class: '00000000-0000-0000-0000-0000000000c1',
	draftZineRiver: '00000000-0000-0000-0000-000000007101',
	publishedZineRiver: '00000000-0000-0000-0000-000000007102',
	draftZineInkwell: '00000000-0000-0000-0000-000000007201',
	assetRiver: '00000000-0000-0000-0000-000000008001',
	versionRiver: '00000000-0000-0000-0000-000000009001'
} as const;

const file = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

function migrationSql(): string[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
}

export function createPool(): PoolType {
	return new Pool({ connectionString: DB_URL, max: 4 });
}

/** Forward migrations only (assumes the shim/auth objects already exist). */
export async function applyMigrations(pool: PoolType): Promise<void> {
	const client = await pool.connect();
	try {
		for (const sql of migrationSql()) await client.query(sql);
	} finally {
		client.release();
	}
}

/** Full reset: drop schemas, then shim → migrations → seed (like `db reset`). */
export async function resetDatabase(pool: PoolType): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query(
			'drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;'
		);
		await client.query(file('tests', 'db', 'supabase-shim.sql'));
		for (const sql of migrationSql()) await client.query(sql);
		await client.query(file('supabase', 'seed.sql'));
	} finally {
		client.release();
	}
}

/** Run the down-migration (tests/db/down.sql). */
export async function runDown(pool: PoolType): Promise<void> {
	await pool.query(file('tests', 'db', 'down.sql'));
}

export type Role = 'anon' | 'authenticated' | 'service_role';
export interface Actor {
	sub?: string;
	role?: Role;
}
const ROLES: Role[] = ['anon', 'authenticated', 'service_role'];

/**
 * Run `fn` inside a transaction impersonating `actor`, then ROLLBACK so every
 * test starts from the same seed. Sets the Postgres role plus both Supabase JWT
 * claim GUC forms: aggregate request.jwt.claims and per-claim request.jwt.claim.*.
 */
export async function asActor<T>(
	pool: PoolType,
	actor: Actor,
	fn: (q: Query) => Promise<T>
): Promise<T> {
	const role = actor.role ?? 'authenticated';
	if (!ROLES.includes(role)) throw new Error(`Unexpected role: ${role}`);
	const claims = actor.sub ? { sub: actor.sub, role } : { role };

	const client = await pool.connect();
	try {
		await client.query('begin');
		await client.query(`set local role ${role}`); // role is whitelisted above
		await client.query("select set_config('request.jwt.claims', $1, true)", [
			JSON.stringify(claims)
		]);
		await client.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
		await client.query("select set_config('request.jwt.claim.sub', $1, true)", [actor.sub ?? '']);
		await client.query("select set_config('request.jwt.claim.email', $1, true)", ['']);
		return await fn(client.query.bind(client) as Query);
	} finally {
		await client.query('rollback').catch(() => {});
		client.release();
	}
}

/** Convenience: row count visible to `actor` for an arbitrary query. */
export async function countAs(
	pool: PoolType,
	actor: Actor,
	sql: string,
	params: unknown[] = []
): Promise<number> {
	return asActor(pool, actor, async (q) => (await q(sql, params)).rowCount ?? 0);
}
