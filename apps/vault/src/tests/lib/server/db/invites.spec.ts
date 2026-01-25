// TDD: Invite system tests (RED phase)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createInvite,
	getInviteByToken,
	getInviteByEmail,
	acceptInvite,
	expireInvite,
	type Invite
} from '$lib/server/db/invites';

// Mock D1 database
function createMockDb() {
	const data: Map<string, Record<string, unknown>> = new Map();
	
	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// Handle INSERT
					if (sql.startsWith('INSERT INTO invites')) {
						const [id, email, role, token, invited_by, expires_at] = params as string[];
						data.set(token, {
							id,
							email,
							role,
							token,
							invited_by,
							expires_at,
							status: 'pending',
							created_at: new Date().toISOString()
						});
					}
					// Handle UPDATE (accept/expire)
					if (sql.includes('UPDATE invites SET status')) {
						const token = params[params.length - 1] as string;
						const invite = data.get(token);
						if (invite) {
							if (sql.includes("status = 'accepted'")) {
								invite.status = 'accepted';
								invite.accepted_at = new Date().toISOString();
							} else if (sql.includes("status = 'expired'")) {
								invite.status = 'expired';
							}
						}
						return { meta: { changes: invite ? 1 : 0 } };
					}
					return { meta: { changes: 1 } };
				},
				first: async () => {
					// Handle SELECT by token
					if (sql.includes('WHERE token = ?')) {
						const token = params[0] as string;
						return data.get(token) ?? null;
					}
					// Handle SELECT by email
					if (sql.includes('WHERE email = ?')) {
						const email = params[0] as string;
						for (const invite of data.values()) {
							if (invite.email === email && invite.status === 'pending') {
								return invite;
							}
						}
						return null;
					}
					return null;
				}
			})
		}),
		_data: data
	};
}

describe('Invite System', () => {
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		mockDb = createMockDb();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
	});

	describe('createInvite', () => {
		it('creates an invite with valid data', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			expect(invite).toBeDefined();
			expect(invite.email).toBe('test@example.com');
			expect(invite.role).toBe('singer');
			expect(invite.token).toBeDefined();
			expect(invite.token.length).toBeGreaterThan(20);
			expect(invite.status).toBe('pending');
			expect(invite.invited_by).toBe('admin-123');
		});

		it('sets 48h expiry by default', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const expiresAt = new Date(invite.expires_at);
			const createdAt = new Date(invite.created_at);
			const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
			
			expect(diffHours).toBe(48);
		});

		it('generates secure random token', async () => {
			const invite1 = await createInvite(mockDb as unknown as D1Database, {
				email: 'test1@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const invite2 = await createInvite(mockDb as unknown as D1Database, {
				email: 'test2@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			expect(invite1.token).not.toBe(invite2.token);
		});
	});

	describe('getInviteByToken', () => {
		it('returns invite when token exists', async () => {
			const created = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const found = await getInviteByToken(mockDb as unknown as D1Database, created.token);

			expect(found).toBeDefined();
			expect(found?.email).toBe('test@example.com');
		});

		it('returns null when token not found', async () => {
			const found = await getInviteByToken(mockDb as unknown as D1Database, 'nonexistent-token');

			expect(found).toBeNull();
		});
	});

	describe('getInviteByEmail', () => {
		it('returns pending invite for email', async () => {
			await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const found = await getInviteByEmail(mockDb as unknown as D1Database, 'test@example.com');

			expect(found).toBeDefined();
			expect(found?.status).toBe('pending');
		});

		it('returns null when no pending invite exists', async () => {
			const found = await getInviteByEmail(mockDb as unknown as D1Database, 'nonexistent@example.com');

			expect(found).toBeNull();
		});
	});

	describe('acceptInvite', () => {
		it('marks invite as accepted and returns member id', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const result = await acceptInvite(mockDb as unknown as D1Database, invite.token);

			expect(result.success).toBe(true);
			expect(result.memberId).toBeDefined();
		});

		it('creates member record on accept', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'librarian',
				invited_by: 'admin-123'
			});

			const result = await acceptInvite(mockDb as unknown as D1Database, invite.token);

			expect(result.success).toBe(true);
			expect(result.memberId).toBeDefined();
		});

		it('rejects expired invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			// Advance time by 49 hours (past 48h expiry)
			vi.setSystemTime(new Date('2025-01-17T13:00:00Z'));

			const result = await acceptInvite(mockDb as unknown as D1Database, invite.token);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invite has expired');
		});

		it('rejects already accepted invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			await acceptInvite(mockDb as unknown as D1Database, invite.token);
			const result = await acceptInvite(mockDb as unknown as D1Database, invite.token);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invite already used');
		});

		it('rejects invalid token', async () => {
			const result = await acceptInvite(mockDb as unknown as D1Database, 'invalid-token');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid invite token');
		});
	});

	describe('expireInvite', () => {
		it('marks invite as expired', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				email: 'test@example.com',
				role: 'singer',
				invited_by: 'admin-123'
			});

			const result = await expireInvite(mockDb as unknown as D1Database, invite.token);

			expect(result).toBe(true);
		});
	});
});
