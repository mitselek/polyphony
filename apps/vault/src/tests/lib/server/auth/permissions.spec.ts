// TDD: Permission system tests (RED phase)
import { describe, it, expect } from 'vitest';
import {
	requireRole,
	hasPermission,
	canUploadScores,
	canDeleteScores,
	canInviteMembers,
	canManageRoles,
	type Member
} from '$lib/server/auth/permissions';

describe('Permission System', () => {
	describe('hasPermission', () => {
		it('owner has all permissions', () => {
			const owner: Member = { id: '1', email: 'owner@test.com', roles: ['owner'] };
			expect(hasPermission(owner, 'scores:upload')).toBe(true);
			expect(hasPermission(owner, 'scores:delete')).toBe(true);
			expect(hasPermission(owner, 'scores:view')).toBe(true);
			expect(hasPermission(owner, 'members:invite')).toBe(true);
			expect(hasPermission(owner, 'roles:manage')).toBe(true);
			expect(hasPermission(owner, 'vault:delete')).toBe(true);
		});

		it('admin has score and member management permissions', () => {
			const admin: Member = { id: '2', email: 'admin@test.com', roles: ['admin'] };
			expect(hasPermission(admin, 'scores:upload')).toBe(false); // Only librarian can upload
			expect(hasPermission(admin, 'scores:delete')).toBe(false); // Only librarian can delete
			expect(hasPermission(admin, 'scores:view')).toBe(true);
			expect(hasPermission(admin, 'members:invite')).toBe(true);
			expect(hasPermission(admin, 'roles:manage')).toBe(true);
			expect(hasPermission(admin, 'vault:delete')).toBe(false);
		});

		it('librarian has score management but not member management', () => {
			const librarian: Member = { id: '3', email: 'librarian@test.com', roles: ['librarian'] };
			expect(hasPermission(librarian, 'scores:upload')).toBe(true);
			expect(hasPermission(librarian, 'scores:delete')).toBe(true);
			expect(hasPermission(librarian, 'scores:view')).toBe(true);
			expect(hasPermission(librarian, 'members:invite')).toBe(false);
			expect(hasPermission(librarian, 'roles:manage')).toBe(false);
			expect(hasPermission(librarian, 'vault:delete')).toBe(false);
		});

		it('singer has view-only permissions', () => {
			const singer: Member = { id: '4', email: 'singer@test.com', roles: [] };
			expect(hasPermission(singer, 'scores:upload')).toBe(false);
			expect(hasPermission(singer, 'scores:delete')).toBe(false);
			expect(hasPermission(singer, 'scores:view')).toBe(true);
			expect(hasPermission(singer, 'scores:download')).toBe(true);
			expect(hasPermission(singer, 'members:invite')).toBe(false);
			expect(hasPermission(singer, 'roles:manage')).toBe(false);
			expect(hasPermission(singer, 'vault:delete')).toBe(false);
		});
	});

	describe('requireRole', () => {
		it('returns success when role meets minimum', () => {
			const member: Member = { id: 'test-123', roles: ['admin'], email: 'test@example.com' };
			const result = requireRole(member, 'admin');
			expect(result.success).toBe(true);
		});

		it('returns success when role exceeds minimum', () => {
			const member: Member = { id: 'test-123', roles: ['owner'], email: 'test@example.com' };
			const result = requireRole(member, 'admin');
			expect(result.success).toBe(true);
		});

		it('returns failure when role below minimum', () => {
			const member: Member = { id: 'test-123', roles: [], email: 'test@example.com' };
			const result = requireRole(member, 'admin');
			expect(result.success).toBe(false);
			expect(result.error).toBe('Insufficient permissions');
		});

		it('returns failure when no member provided', () => {
			const result = requireRole(null, 'librarian');
			expect(result.success).toBe(false);
			expect(result.error).toBe('Authentication required');
		});
	});

	describe('permission helpers', () => {
		it('canUploadScores returns true for admin+', () => {
			expect(canUploadScores({ id: '1', roles: ['owner'], email: 't@t.com' })).toBe(true);
			expect(canUploadScores({ id: '2', roles: ['admin'], email: 't@t.com' })).toBe(false); // Admin doesn't have upload
			expect(canUploadScores({ id: '3', roles: ['librarian'], email: 't@t.com' })).toBe(true);
			expect(canUploadScores({ id: '4', roles: [], email: 't@t.com' })).toBe(false);
		});

		it('canDeleteScores returns true for admin+', () => {
			expect(canDeleteScores({ id: '1', roles: ['owner'], email: 't@t.com' })).toBe(true);
			expect(canDeleteScores({ id: '2', roles: ['admin'], email: 't@t.com' })).toBe(false); // Admin doesn't have delete
			expect(canDeleteScores({ id: '3', roles: ['librarian'], email: 't@t.com' })).toBe(true);
			expect(canDeleteScores({ id: '4', roles: [], email: 't@t.com' })).toBe(false);
		});

		it('canInviteMembers returns true for admin+ only', () => {
			expect(canInviteMembers({ id: '1', roles: ['owner'], email: 't@t.com' })).toBe(true);
			expect(canInviteMembers({ id: '2', roles: ['admin'], email: 't@t.com' })).toBe(true);
			expect(canInviteMembers({ id: '3', roles: ['librarian'], email: 't@t.com' })).toBe(false);
			expect(canInviteMembers({ id: '4', roles: [], email: 't@t.com' })).toBe(false);
		});

		it('canManageRoles returns true for admin+ only', () => {
			expect(canManageRoles({ id: '1', roles: ['owner'], email: 't@t.com' })).toBe(true);
			expect(canManageRoles({ id: '2', roles: ['admin'], email: 't@t.com' })).toBe(true);
			expect(canManageRoles({ id: '3', roles: ['librarian'], email: 't@t.com' })).toBe(false);
			expect(canManageRoles({ id: '4', roles: [], email: 't@t.com' })).toBe(false);
		});
	});
});
