// TDD: Permission system tests (RED phase)
import { describe, it, expect, beforeEach } from 'vitest';
import {
	requireRole,
	hasPermission,
	canUploadScores,
	canDeleteScores,
	canInviteMembers,
	canManageMembers,
	type Role,
	type Permission
} from '$lib/server/auth/permissions';

describe('Permission System', () => {
	describe('hasPermission', () => {
		it('owner has all permissions', () => {
			expect(hasPermission('owner', 'scores:upload')).toBe(true);
			expect(hasPermission('owner', 'scores:delete')).toBe(true);
			expect(hasPermission('owner', 'scores:view')).toBe(true);
			expect(hasPermission('owner', 'members:invite')).toBe(true);
			expect(hasPermission('owner', 'members:manage')).toBe(true);
			expect(hasPermission('owner', 'vault:delete')).toBe(true);
		});

		it('admin has score and member management permissions', () => {
			expect(hasPermission('admin', 'scores:upload')).toBe(true);
			expect(hasPermission('admin', 'scores:delete')).toBe(true);
			expect(hasPermission('admin', 'scores:view')).toBe(true);
			expect(hasPermission('admin', 'members:invite')).toBe(true);
			expect(hasPermission('admin', 'members:manage')).toBe(true);
			expect(hasPermission('admin', 'vault:delete')).toBe(false);
		});

		it('librarian has score management but not member management', () => {
			expect(hasPermission('librarian', 'scores:upload')).toBe(true);
			expect(hasPermission('librarian', 'scores:delete')).toBe(true);
			expect(hasPermission('librarian', 'scores:view')).toBe(true);
			expect(hasPermission('librarian', 'members:invite')).toBe(false);
			expect(hasPermission('librarian', 'members:manage')).toBe(false);
			expect(hasPermission('librarian', 'vault:delete')).toBe(false);
		});

		it('singer has view-only permissions', () => {
			expect(hasPermission('singer', 'scores:upload')).toBe(false);
			expect(hasPermission('singer', 'scores:delete')).toBe(false);
			expect(hasPermission('singer', 'scores:view')).toBe(true);
			expect(hasPermission('singer', 'scores:download')).toBe(true);
			expect(hasPermission('singer', 'members:invite')).toBe(false);
			expect(hasPermission('singer', 'members:manage')).toBe(false);
			expect(hasPermission('singer', 'vault:delete')).toBe(false);
		});
	});

	describe('requireRole', () => {
		const mockMember = (role: Role) => ({ id: 'test-123', role, email: 'test@example.com' });

		it('returns success when role meets minimum', () => {
			const result = requireRole(mockMember('admin'), 'admin');
			expect(result.success).toBe(true);
		});

		it('returns success when role exceeds minimum', () => {
			const result = requireRole(mockMember('owner'), 'admin');
			expect(result.success).toBe(true);
		});

		it('returns failure when role below minimum', () => {
			const result = requireRole(mockMember('singer'), 'admin');
			expect(result.success).toBe(false);
			expect(result.error).toBe('Insufficient permissions');
		});

		it('returns failure when no member provided', () => {
			const result = requireRole(null, 'singer');
			expect(result.success).toBe(false);
			expect(result.error).toBe('Authentication required');
		});
	});

	describe('permission helpers', () => {
		it('canUploadScores returns true for admin+', () => {
			expect(canUploadScores('owner')).toBe(true);
			expect(canUploadScores('admin')).toBe(true);
			expect(canUploadScores('librarian')).toBe(true);
			expect(canUploadScores('singer')).toBe(false);
		});

		it('canDeleteScores returns true for admin+', () => {
			expect(canDeleteScores('owner')).toBe(true);
			expect(canDeleteScores('admin')).toBe(true);
			expect(canDeleteScores('librarian')).toBe(true);
			expect(canDeleteScores('singer')).toBe(false);
		});

		it('canInviteMembers returns true for admin+ only', () => {
			expect(canInviteMembers('owner')).toBe(true);
			expect(canInviteMembers('admin')).toBe(true);
			expect(canInviteMembers('librarian')).toBe(false);
			expect(canInviteMembers('singer')).toBe(false);
		});

		it('canManageMembers returns true for admin+ only', () => {
			expect(canManageMembers('owner')).toBe(true);
			expect(canManageMembers('admin')).toBe(true);
			expect(canManageMembers('librarian')).toBe(false);
			expect(canManageMembers('singer')).toBe(false);
		});
	});
});
