// Tests for permissions with registration checks (Issue #97)
import { describe, it, expect } from 'vitest';
import { hasPermission } from '$lib/server/auth/permissions';
import type { Member } from '$lib/server/auth/permissions';

describe('Permissions - Registration checks', () => {
	it('roster-only member has NO permissions', () => {
		const rosterMember: Member = {
			id: 'roster-1',
			email_id: null, // NOT registered
			roles: ['librarian'] // Has roles but not registered
		};

		// Even basic permissions should be denied
		expect(hasPermission(rosterMember, 'scores:view')).toBe(false);
		expect(hasPermission(rosterMember, 'scores:download')).toBe(false);
		expect(hasPermission(rosterMember, 'scores:upload')).toBe(false);
	});

	it('registered member with no roles can view and download', () => {
		const registeredMember: Member = {
			id: 'member-1',
			email_id: 'user@example.com', // IS registered
			roles: [] // No roles
		};

		// Basic permissions granted
		expect(hasPermission(registeredMember, 'scores:view')).toBe(true);
		expect(hasPermission(registeredMember, 'scores:download')).toBe(true);

		// No advanced permissions
		expect(hasPermission(registeredMember, 'scores:upload')).toBe(false);
		expect(hasPermission(registeredMember, 'members:invite')).toBe(false);
	});

	it('registered librarian can upload and delete scores', () => {
		const librarian: Member = {
			id: 'member-2',
			email_id: 'librarian@example.com',
			roles: ['librarian']
		};

		expect(hasPermission(librarian, 'scores:view')).toBe(true);
		expect(hasPermission(librarian, 'scores:download')).toBe(true);
		expect(hasPermission(librarian, 'scores:upload')).toBe(true);
		expect(hasPermission(librarian, 'scores:delete')).toBe(true);

		// Not an admin
		expect(hasPermission(librarian, 'members:invite')).toBe(false);
	});

	it('registered admin can manage members and roles', () => {
		const admin: Member = {
			id: 'member-3',
			email_id: 'admin@example.com',
			roles: ['admin']
		};

		expect(hasPermission(admin, 'scores:view')).toBe(true);
		expect(hasPermission(admin, 'members:invite')).toBe(true);
		expect(hasPermission(admin, 'roles:manage')).toBe(true);

		// Not a librarian
		expect(hasPermission(admin, 'scores:upload')).toBe(false);
	});

	it('registered owner has all permissions', () => {
		const owner: Member = {
			id: 'member-4',
			email_id: 'owner@example.com',
			roles: ['owner']
		};

		// All permissions granted
		expect(hasPermission(owner, 'scores:view')).toBe(true);
		expect(hasPermission(owner, 'scores:download')).toBe(true);
		expect(hasPermission(owner, 'scores:upload')).toBe(true);
		expect(hasPermission(owner, 'scores:delete')).toBe(true);
		expect(hasPermission(owner, 'members:invite')).toBe(true);
		expect(hasPermission(owner, 'roles:manage')).toBe(true);
		expect(hasPermission(owner, 'vault:delete')).toBe(true);
		expect(hasPermission(owner, 'events:create')).toBe(true);
	});

	it('null member has no permissions', () => {
		expect(hasPermission(null, 'scores:view')).toBe(false);
		expect(hasPermission(null, 'scores:download')).toBe(false);
	});

	it('undefined member has no permissions', () => {
		expect(hasPermission(undefined, 'scores:view')).toBe(false);
		expect(hasPermission(undefined, 'scores:download')).toBe(false);
	});

	it('registered member with multiple roles gets union of permissions', () => {
		const multiRole: Member = {
			id: 'member-5',
			email_id: 'multi@example.com',
			roles: ['librarian', 'admin']
		};

		// Librarian permissions
		expect(hasPermission(multiRole, 'scores:upload')).toBe(true);
		expect(hasPermission(multiRole, 'scores:delete')).toBe(true);

		// Admin permissions
		expect(hasPermission(multiRole, 'members:invite')).toBe(true);
		expect(hasPermission(multiRole, 'roles:manage')).toBe(true);
	});

	it('registered conductor can manage events and record attendance', () => {
		const conductor: Member = {
			id: 'member-6',
			email_id: 'conductor@example.com',
			roles: ['conductor']
		};

		expect(hasPermission(conductor, 'scores:view')).toBe(true);
		expect(hasPermission(conductor, 'events:create')).toBe(true);
		expect(hasPermission(conductor, 'events:manage')).toBe(true);
		expect(hasPermission(conductor, 'events:delete')).toBe(true);
		expect(hasPermission(conductor, 'attendance:record')).toBe(true);

		// Not an admin
		expect(hasPermission(conductor, 'members:invite')).toBe(false);
	});

	it('registered section leader can record attendance', () => {
		const sectionLeader: Member = {
			id: 'member-7',
			email_id: 'leader@example.com',
			roles: ['section_leader']
		};

		expect(hasPermission(sectionLeader, 'scores:view')).toBe(true);
		expect(hasPermission(sectionLeader, 'attendance:record')).toBe(true);

		// Cannot create events
		expect(hasPermission(sectionLeader, 'events:create')).toBe(false);
	});
});
