import { describe, expect, it } from 'vitest';
import { subject } from '@casl/ability';
import { defineAbilityFor, type AbilityUser } from './abilities';

const admin: AbilityUser = { id: 'admin-1', role: 'admin' };
const teacher: AbilityUser = { id: 'teacher-1', role: 'teacher' };
const student: AbilityUser = { id: 'student-1', role: 'student' };
const other = 'student-2';

describe('admin ability — sees & does everything', () => {
	const a = defineAbilityFor(admin);
	it('can manage every subject', () => {
		for (const s of [
			'User',
			'School',
			'Class',
			'ClassMember',
			'Zine',
			'Asset',
			'Report',
			'ModerationItem'
		] as const) {
			expect(a.can('manage', s), s).toBe(true);
		}
	});
	it("can edit another user's zine and change roles", () => {
		expect(a.can('update', subject('Zine', { owner_id: other }))).toBe(true);
		expect(a.can('update', subject('User', { id: other }))).toBe(true);
		expect(a.can('delete', subject('Zine', { owner_id: other }))).toBe(true);
	});
});

describe('teacher ability — moderates a classroom, owns their own work', () => {
	const a = defineAbilityFor(teacher);
	it('can moderate students’ zines/assets and triage reports + moderation items', () => {
		expect(a.can('moderate', 'Zine')).toBe(true);
		expect(a.can('moderate', 'Asset')).toBe(true);
		expect(a.can('read', 'User')).toBe(true);
		expect(a.can('update', 'Report')).toBe(true);
		expect(a.can('manage', 'ModerationItem')).toBe(true);
	});
	it('manages their OWN class but not another teacher’s', () => {
		expect(a.can('manage', subject('Class', { teacher_id: teacher.id }))).toBe(true);
		expect(a.can('manage', subject('Class', { teacher_id: 'teacher-2' }))).toBe(false);
	});
	it('owns their own zine but cannot delete a student’s zine (RLS: delete is owner/admin only)', () => {
		expect(a.can('update', subject('Zine', { owner_id: teacher.id }))).toBe(true);
		expect(a.can('delete', subject('Zine', { owner_id: other }))).toBe(false);
	});
	it('cannot change roles or do admin-only things', () => {
		expect(a.can('update', subject('User', { id: other }))).toBe(false);
		expect(a.can('manage', 'School')).toBe(false);
	});
});

describe('student ability — own content only', () => {
	const a = defineAbilityFor(student);
	it('edits its OWN zine/asset but not someone else’s', () => {
		expect(a.can('update', subject('Zine', { owner_id: student.id }))).toBe(true);
		expect(a.can('delete', subject('Asset', { owner_id: student.id }))).toBe(true);
		expect(a.can('update', subject('Zine', { owner_id: other }))).toBe(false);
		expect(a.can('read', subject('Zine', { owner_id: other }))).toBe(false);
	});
	it('can file a report + read its own, but cannot moderate or manage classes/users', () => {
		expect(a.can('create', 'Report')).toBe(true);
		expect(a.can('read', subject('Report', { reporter_id: student.id }))).toBe(true);
		expect(a.can('read', subject('Report', { reporter_id: other }))).toBe(false);
		expect(a.can('moderate', 'Zine')).toBe(false);
		expect(a.can('manage', 'Class')).toBe(false);
		expect(a.can('read', subject('User', { id: other }))).toBe(false);
	});
});

describe('signed-out ability — nothing', () => {
	const a = defineAbilityFor(null);
	it('cannot do anything', () => {
		expect(a.can('read', subject('Zine', { owner_id: 'anyone' }))).toBe(false);
		expect(a.can('manage', 'all')).toBe(false);
		expect(a.can('create', 'Report')).toBe(false);
	});
});
