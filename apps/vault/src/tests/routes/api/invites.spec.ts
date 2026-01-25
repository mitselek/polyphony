// TDD: Invite API tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as createInviteHandler } from '$lib/server/api/invites';
import { GET as acceptInviteHandler } from '$lib/server/api/auth';

// Mock D1 database for testing
function createMockDb() {
	const members: Map<string, Record<string, unknown>> = new Map();
	const invites: Map<string, Record<string, unknown>> = new Map();
	
	// Add an admin member for testing
	members.set('admin-123', {
		id: 'admin-123',
		email: 'admin@example.com',
		name: 'Admin User',
		role: 'admin',
		invited_by: null,
		joined_at: '2025-01-01T00:00:00Z'
	});

	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// Handle INSERT INTO invites
					if (sql.includes('INSERT INTO invites')) {
						const [id, email, role, token, invited_by, expires_at, created_at] = params as string[];
						invites.set(token, {
							id,
							email,
							role,
							token,
							invited_by,
							expires_at,
							status: 'pending',
							created_at,
							accepted_at: null
						});
					}
					// Handle INSERT INTO members (from accept)
					if (sql.includes('INSERT INTO members')) {
						const [id, email, name, role, invited_by] = params as string[];
						members.set(id, { id, email, name, role, invited_by, joined_at: new Date().toISOString() });
					}
					// Handle UPDATE invites
					if (sql.includes('UPDATE invites SET status')) {
						const token = params[params.length - 1] as string;
						const invite = invites.get(token);
						if (invite) {
							if (sql.includes("status = 'accepted'")) {
								invite.status = 'accepted';
								invite.accepted_at = params[0] as string;
							} else if (sql.includes("status = 'expired'")) {
								invite.status = 'expired';
							}
						}
						return { meta: { changes: invite ? 1 : 0 } };
					}
					return { meta: { changes: 1 } };
				},
				first: async <T>(): Promise<T | null> => {
					// Handle SELECT member by id
					if (sql.includes('FROM members WHERE id')) {
						const id = params[0] as string;
						return (members.get(id) as T) ?? null;
					}
					// Handle SELECT member by email
					if (sql.includes('FROM members WHERE email')) {
						const email = params[0] as string;
						for (const m of members.values()) {
							if (m.email === email) return m as T;
						}
						return null;
					}
					// Handle SELECT invite by token
					if (sql.includes('FROM invites WHERE token')) {
						const token = params[0] as string;
						return (invites.get(token) as T) ?? null;
					}
					// Handle SELECT invite by email
					if (sql.includes('FROM invites WHERE email') && sql.includes("status = 'pending'")) {
						const email = params[0] as string;
						for (const inv of invites.values()) {
							if (inv.email === email && inv.status === 'pending') {
								return inv as T;
							}
						}
						return null;
					}
					return null;
				}
			})
		}),
		_members: members,
		_invites: invites
	};
}

describe('POST /api/members/invite', () => {
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		mockDb = createMockDb();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
	});

	it('creates invite when valid admin request', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: {
				email: 'newmember@example.com',
				role: 'singer'
			},
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(true);
		expect(result.invite).toBeDefined();
		expect(result.invite?.email).toBe('newmember@example.com');
		expect(result.invite?.role).toBe('singer');
	});

	it('returns error when email already has pending invite', async () => {
		// Create first invite
		await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'duplicate@example.com', role: 'singer' },
			invitedBy: 'admin-123'
		});

		// Try to create duplicate
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'duplicate@example.com', role: 'singer' },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Email already has a pending invite');
	});

	it('returns error when email is already a member', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'admin@example.com', role: 'singer' },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Email is already a member');
	});

	it('validates email format', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'not-an-email', role: 'singer' },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Invalid email format');
	});

	it('validates role', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'test@example.com', role: 'superadmin' as 'admin' },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Invalid role');
	});
});

describe('GET /api/auth/accept', () => {
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		mockDb = createMockDb();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
	});

	it('accepts valid invite and creates member', async () => {
		// Create invite first
		const inviteResult = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'newmember@example.com', role: 'singer' },
			invitedBy: 'admin-123'
		});

		const result = await acceptInviteHandler({
			db: mockDb as unknown as D1Database,
			token: inviteResult.invite!.token
		});

		expect(result.success).toBe(true);
		expect(result.memberId).toBeDefined();
	});

	it('rejects invalid token', async () => {
		const result = await acceptInviteHandler({
			db: mockDb as unknown as D1Database,
			token: 'invalid-token-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Invalid invite token');
	});

	it('rejects expired invite', async () => {
		// Create invite
		const inviteResult = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { email: 'newmember@example.com', role: 'singer' },
			invitedBy: 'admin-123'
		});

		// Advance time past expiry
		vi.setSystemTime(new Date('2025-01-17T13:00:00Z'));

		const result = await acceptInviteHandler({
			db: mockDb as unknown as D1Database,
			token: inviteResult.invite!.token
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Invite has expired');
	});
});
