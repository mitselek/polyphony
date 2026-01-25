// TDD: Auth middleware tests
import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware, getMemberFromCookie } from '$lib/server/auth/middleware';

// Mock D1 database
function createMockDb() {
	const members: Map<string, Record<string, unknown>> = new Map();
	
	members.set('member-123', {
		id: 'member-123',
		email: 'singer@example.com',
		role: 'singer',
		name: 'Singer User'
	});
	
	members.set('admin-456', {
		id: 'admin-456',
		email: 'admin@example.com',
		role: 'admin',
		name: 'Admin User'
	});

	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				first: async <T>(): Promise<T | null> => {
					if (sql.includes('FROM members WHERE id')) {
						const id = params[0] as string;
						return (members.get(id) as T) ?? null;
					}
					return null;
				}
			})
		}),
		_members: members
	};
}

describe('Auth Middleware', () => {
	describe('getMemberFromCookie', () => {
		it('returns member when valid cookie exists', async () => {
			const mockDb = createMockDb();
			const member = await getMemberFromCookie(
				mockDb as unknown as D1Database,
				'member-123'
			);

			expect(member).toBeDefined();
			expect(member?.id).toBe('member-123');
			expect(member?.role).toBe('singer');
		});

		it('returns null when cookie is empty', async () => {
			const mockDb = createMockDb();
			const member = await getMemberFromCookie(
				mockDb as unknown as D1Database,
				''
			);

			expect(member).toBeNull();
		});

		it('returns null when member not found', async () => {
			const mockDb = createMockDb();
			const member = await getMemberFromCookie(
				mockDb as unknown as D1Database,
				'nonexistent-id'
			);

			expect(member).toBeNull();
		});
	});

	describe('createAuthMiddleware', () => {
		it('allows request when role meets minimum', async () => {
			const mockDb = createMockDb();
			const middleware = createAuthMiddleware('singer');

			const result = await middleware({
				db: mockDb as unknown as D1Database,
				memberId: 'member-123'
			});

			expect(result.authorized).toBe(true);
			expect(result.member).toBeDefined();
		});

		it('allows request when role exceeds minimum', async () => {
			const mockDb = createMockDb();
			const middleware = createAuthMiddleware('singer');

			const result = await middleware({
				db: mockDb as unknown as D1Database,
				memberId: 'admin-456'
			});

			expect(result.authorized).toBe(true);
			expect(result.member?.role).toBe('admin');
		});

		it('rejects request when role below minimum', async () => {
			const mockDb = createMockDb();
			const middleware = createAuthMiddleware('admin');

			const result = await middleware({
				db: mockDb as unknown as D1Database,
				memberId: 'member-123'
			});

			expect(result.authorized).toBe(false);
			expect(result.status).toBe(403);
			expect(result.error).toBe('Insufficient permissions');
		});

		it('rejects request when not authenticated', async () => {
			const mockDb = createMockDb();
			const middleware = createAuthMiddleware('singer');

			const result = await middleware({
				db: mockDb as unknown as D1Database,
				memberId: ''
			});

			expect(result.authorized).toBe(false);
			expect(result.status).toBe(401);
			expect(result.error).toBe('Authentication required');
		});
	});
});
