// TDD: Invite API tests (name-based, multi-role)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as createInviteHandler } from '$lib/server/api/invites';

// Mock D1 database for testing with name-based invites
function createMockDb() {
	const members: Map<string, Record<string, unknown>> = new Map();
	const memberRoles: Map<string, string[]> = new Map();
	const invites: Map<string, Record<string, unknown>> = new Map();
	
	// Add an admin member for testing
	members.set('admin-123', {
		id: 'admin-123',
		email: 'admin@example.com',
		name: 'Admin User',
		voice_part: null,
		invited_by: null,
		joined_at: '2025-01-01T00:00:00Z'
	});
	memberRoles.set('admin-123', ['admin']);

	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// Handle INSERT INTO invites (name-based, multi-role)
					if (sql.includes('INSERT INTO invites')) {
						const [id, name, token, invited_by, expires_at, roles, voice_part, created_at] = params as any[];
						invites.set(token, {
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
					// Handle INSERT INTO members (from accept)
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
					// Handle UPDATE invites
					if (sql.includes('UPDATE invites SET status')) {
						const token = params[params.length - 1] as string;
						const invite = invites.get(token);
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
						const inv = invites.get(token);
						if (inv) {
							// Parse roles JSON for return
							return { ...inv, roles: JSON.parse(inv.roles as string) } as T;
						}
						return null;
					}
					// Handle SELECT invite by name (with pending status)
					if (sql.includes('FROM invites WHERE name')) {
						const name = params[0] as string;
						for (const inv of invites.values()) {
							if (inv.name === name && inv.status === 'pending') {
								// Parse roles JSON for return
								return { ...inv, roles: JSON.parse(inv.roles as string) } as T;
							}
						}
						return null;
					}
					return null;
				},
				all: async () => {
					// SELECT roles for member
					if (sql.includes('FROM member_roles')) {
						const member_id = params[0] as string;
						const roles = memberRoles.get(member_id) || [];
						return { results: roles.map(role => ({ role })) };
					}
					return { results: [] };
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
		_members: members,
		_memberRoles: memberRoles,
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
			body: { name: 'John Doe', roles: ['librarian'] },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(true);
		expect(result.invite).toBeDefined();
		expect(result.invite?.name).toBe('John Doe');
		expect(result.invite?.roles).toEqual(['librarian']);
		expect(result.invite?.token).toBeDefined();
	});

	it('creates invite with multiple roles', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: 'Jane Admin', roles: ['admin', 'librarian'] },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(true);
		expect(result.invite?.roles).toEqual(['admin', 'librarian']);
	});

	it('creates invite with voice part', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: 'Soprano Singer', roles: ['librarian'], voice_part: 'S' },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(true);
		expect(result.invite?.voice_part).toBe('S');
	});

	it('returns error when name already has pending invite', async () => {
		// Create first invite
		await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: 'Duplicate Name', roles: ['librarian'] },
			invitedBy: 'admin-123'
		});

		// Try to create duplicate
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: 'Duplicate Name', roles: ['librarian'] },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Name already has a pending invite');
	});

	it('validates name is required', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: '', roles: ['librarian'] },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('Name is required');
	});

	it('validates roles array is required', async () => {
		const result = await createInviteHandler({
			db: mockDb as unknown as D1Database,
			body: { name: 'Test User', roles: [] },
			invitedBy: 'admin-123'
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('At least one role is required');
	});
});

// Note: Acceptance flow now handled by Registry OAuth callback
// The invite token is used in the OAuth flow, and acceptInvite is called
// with the verified email from Registry. This would be tested in E2E tests.
