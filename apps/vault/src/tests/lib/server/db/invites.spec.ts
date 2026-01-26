// TDD: Invite system tests (name-based, multi-role)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createInvite,
	getInviteByToken,
	getInviteByName,
	acceptInvite,
	renewInvite,
	type Invite
} from '$lib/server/db/invites';

// Mock D1 database for name-based, multi-role invites
function createMockDb() {
	const data: Map<string, Record<string, unknown>> = new Map();
	const members: Map<string, Record<string, unknown>> = new Map();
	const memberRoles: Map<string, string[]> = new Map();
	
	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// Handle INSERT INTO invites (name-based)
					if (sql.startsWith('INSERT INTO invites')) {
						const [id, name, token, invited_by, expires_at, roles, voice_part, created_at] = params as any[];
						data.set(token, {
							id,
							name,
							token,
							invited_by,
							expires_at,
							status: 'pending',
							roles: JSON.stringify(roles), // Store as JSON string like D1 would
							voice_part,
							created_at,
							accepted_at: null,
							accepted_by_email: null
						});
					}
					// Handle INSERT INTO members
					if (sql.includes('INSERT INTO members')) {
						const [id, email, name, voice_part, invited_by] = params as string[];
						members.set(id, { id, email, name, voice_part, invited_by, joined_at: new Date().toISOString() });
					}
					// Handle INSERT INTO member_roles
					if (sql.includes('INSERT INTO member_roles')) {
						const [member_id, role] = params as [string, string];
						const roles = memberRoles.get(member_id) || [];
						roles.push(role);
						memberRoles.set(member_id, roles);
						return { success: true };
					}
					// Handle UPDATE (accept/expire/renew)
					if (sql.includes('UPDATE invites SET status')) {
						const token = params[params.length - 1] as string;
						const invite = data.get(token);
						if (invite) {
							if (sql.includes("status = 'accepted'")) {
								invite.status = 'accepted';
								invite.accepted_at = params[0] as string;
								invite.accepted_by_email = params[1] as string;
							} else if (sql.includes("status = 'expired'")) {
								invite.status = 'expired';
							}
						}
						return { meta: { changes: invite ? 1 : 0 } };
					}
					// Handle UPDATE expires_at (renewInvite)
					if (sql.includes('UPDATE invites') && sql.includes('SET expires_at')) {
						const [newExpiresAt, inviteId] = params as [string, string];
						for (const invite of data.values()) {
							if (invite.id === inviteId && invite.status === 'pending') {
								invite.expires_at = newExpiresAt;
								return { meta: { changes: 1 } };
							}
						}
						return { meta: { changes: 0 } };
					}
					return { meta: { changes: 1 } };
				},
				first: async () => {
					// Handle SELECT by token
					if (sql.includes('WHERE token = ?')) {
						const token = params[0] as string;
						const inv = data.get(token);
						if (inv) {
							// Parse roles JSON for return
							return { ...inv, roles: JSON.parse(inv.roles as string) };
						}
						return null;
					}
					// Handle SELECT by name
					if (sql.includes('WHERE name = ?')) {
						const name = params[0] as string;
						for (const invite of data.values()) {
							if (invite.name === name && invite.status === 'pending') {
								// Parse roles JSON for return
								return { ...invite, roles: JSON.parse(invite.roles as string) };
							}
						}
						return null;
					}
					// Handle SELECT by id (for renewInvite)
					if (sql.includes('WHERE id = ?')) {
						const inviteId = params[0] as string;
						for (const invite of data.values()) {
							if (invite.id === inviteId) {
								// Parse roles JSON for return
								return { ...invite, roles: JSON.parse(invite.roles as string) };
							}
						}
						return null;
					}
					return null;
				}
			})
		}),
		batch: async (statements: any[]) => {
			// Execute all statements (for role insertion)
			const results = [];
			for (const stmt of statements) {
				const result = await stmt.run();
				results.push(result);
			}
			return results;
		},
		_data: data,
		_members: members,
		_memberRoles: memberRoles
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
				name: 'John Doe',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			expect(invite).toBeDefined();
			expect(invite.name).toBe('John Doe');
			expect(invite.roles).toEqual(['librarian']);
			expect(invite.token).toBeDefined();
			expect(invite.token.length).toBeGreaterThan(20);
			expect(invite.status).toBe('pending');
			expect(invite.invited_by).toBe('admin-123');
		});

		it('sets 48h expiry by default', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			const expiresAt = new Date(invite.expires_at);
			const createdAt = new Date(invite.created_at);
			const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
			
			expect(diffHours).toBe(48);
		});

		it('generates secure random token', async () => {
			const invite1 = await createInvite(mockDb as unknown as D1Database, {
				name: 'User One',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			const invite2 = await createInvite(mockDb as unknown as D1Database, {
				name: 'User Two',
				roles: ['admin'],
				invited_by: 'admin-123'
			});

			expect(invite1.token).not.toBe(invite2.token);
			expect(invite1.token.length).toBeGreaterThan(40);
		});
	});

	describe('getInviteByToken', () => {
		it('returns invite when token exists', async () => {
			const created = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			const found = await getInviteByToken(mockDb as unknown as D1Database, created.token);

			expect(found).toBeDefined();
			expect(found?.name).toBe('Test User');
			expect(found?.roles).toEqual(['librarian']);
		});

		it('returns null when token not found', async () => {
			const found = await getInviteByToken(mockDb as unknown as D1Database, 'nonexistent');
			expect(found).toBeNull();
		});
	});

	describe('getInviteByName', () => {
		it('returns pending invite for name', async () => {
			await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			const found = await getInviteByName(mockDb as unknown as D1Database, 'Test User');

			expect(found).toBeDefined();
			expect(found?.name).toBe('Test User');
			expect(found?.status).toBe('pending');
		});

		it('returns null when no pending invite exists', async () => {
			const found = await getInviteByName(mockDb as unknown as D1Database, 'Nonexistent');
			expect(found).toBeNull();
		});
	});

	describe('acceptInvite', () => {
		it('marks invite as accepted and creates member with roles', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'New Member',
				roles: ['admin', 'librarian'],
				invited_by: 'admin-123'
			});

			const result = await acceptInvite(
				mockDb as unknown as D1Database,
				invite.token,
				'newmember@example.com',
				'New Member'
			);

			expect(result.success).toBe(true);
			expect(result.memberId).toBeDefined();

			// Verify invite was marked accepted
			const updatedInvite = await getInviteByToken(mockDb as unknown as D1Database, invite.token);
			expect(updatedInvite?.status).toBe('accepted');
			expect(updatedInvite?.accepted_by_email).toBe('newmember@example.com');
		});

		it('creates member record on accept', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Jane Doe',
				roles: ['librarian'],
				voice_part: 'S',
				invited_by: 'admin-123'
			});

			const result = await acceptInvite(
				mockDb as unknown as D1Database,
				invite.token,
				'jane@example.com'
			);

			expect(result.success).toBe(true);
			const member = mockDb._members.get(result.memberId!);
			expect(member).toBeDefined();
			expect(member?.email).toBe('jane@example.com');
			expect(member?.voice_part).toBe('S');
		});

		it('rejects expired invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Expired User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			// Advance time past expiry
			vi.setSystemTime(new Date('2025-01-17T13:00:00Z'));

			const result = await acceptInvite(
				mockDb as unknown as D1Database,
				invite.token,
				'expired@example.com'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invite has expired');
		});

		it('rejects already accepted invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			// Accept once
			await acceptInvite(mockDb as unknown as D1Database, invite.token, 'test@example.com');

			// Try to accept again
			const result = await acceptInvite(mockDb as unknown as D1Database, invite.token, 'test2@example.com');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invite already used');
		});

		it('rejects invalid token', async () => {
			const result = await acceptInvite(
				mockDb as unknown as D1Database,
				'invalid-token',
				'test@example.com'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid invite token');
		});
	});

	describe('renewInvite', () => {
		it('extends expires_at by 48 hours from now', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			const originalExpiry = new Date(invite.expires_at);
			const beforeRenew = Date.now();

			const renewed = await renewInvite(mockDb as unknown as D1Database, invite.id);

			expect(renewed).not.toBeNull();
			const newExpiry = new Date(renewed!.expires_at);

			// New expiry should be ~48 hours from now (not from original expiry)
			const expectedExpiry = beforeRenew + 48 * 60 * 60 * 1000;
			const timeDiff = Math.abs(newExpiry.getTime() - expectedExpiry);
			expect(timeDiff).toBeLessThan(1000); // Within 1 second tolerance
		});

		it('can renew already-expired invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			// Force expiration by setting expires_at to past
			const pastExpiry = new Date(Date.now() - 1000).toISOString();
			await mockDb.prepare('UPDATE invites SET expires_at = ? WHERE id = ?')
				.bind(pastExpiry, invite.id)
				.run();

			const renewed = await renewInvite(mockDb as unknown as D1Database, invite.id);

			expect(renewed).not.toBeNull();
			const newExpiry = new Date(renewed!.expires_at);
			const now = Date.now();
			expect(newExpiry.getTime()).toBeGreaterThan(now);
		});

		it('returns null for non-existent invite', async () => {
			const result = await renewInvite(mockDb as unknown as D1Database, 'non-existent-id');

			expect(result).toBeNull();
		});

		it('returns null for accepted invite', async () => {
			const invite = await createInvite(mockDb as unknown as D1Database, {
				name: 'Test User',
				roles: ['librarian'],
				invited_by: 'admin-123'
			});

			// Accept the invite
			await acceptInvite(mockDb as unknown as D1Database, invite.token, 'test@example.com');

			// Try to renew accepted invite
			const result = await renewInvite(mockDb as unknown as D1Database, invite.id);

			expect(result).toBeNull();
		});
	});
});
