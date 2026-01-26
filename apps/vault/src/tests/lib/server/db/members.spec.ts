// TDD: Member database operations tests
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from 'vitest';
import { createMember, getMemberByEmail, getMemberById } from '../../../../lib/server/db/members.js';

// Mock D1 database with multi-role support
const createMockDb = () => {
	const members = new Map<string, { id: string; email: string; name: string | null; voice_part: string | null; invited_by: string | null; joined_at: string }>();
	const memberRoles = new Map<string, string[]>(); // member_id -> roles[]
	
	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// INSERT INTO members
					if (sql.includes('INSERT INTO members')) {
						const [id, email, name, voice_part, invited_by] = params as [string, string, string | null, string | null, string | null];
						members.set(id, { id, email, name, voice_part, invited_by, joined_at: new Date().toISOString() });
						return { success: true };
					}
					// INSERT INTO member_roles
					if (sql.includes('INSERT INTO member_roles')) {
						const [member_id, role] = params as [string, string];
						const roles = memberRoles.get(member_id) || [];
						roles.push(role);
						memberRoles.set(member_id, roles);
						return { success: true };
					}
					return { success: false };
				},
				first: async () => {
					// SELECT member by email
					if (sql.includes('FROM members') && sql.includes('WHERE email =')) {
						const email = params[0] as string;
						for (const member of members.values()) {
							if (member.email === email) return member;
						}
						return null;
					}
					// SELECT member by id
					if (sql.includes('FROM members') && sql.includes('WHERE id =')) {
						const id = params[0] as string;
						return members.get(id) || null;
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
			// The statements are prepared statements with bound parameters
			const results = [];
			for (const stmt of statements) {
				// Execute the statement by calling run()
				const result = await stmt.run();
				results.push(result);
			}
			return results;
		}
	} as unknown as D1Database;
};

describe('Member database operations', () => {
	let db: D1Database;

	beforeEach(() => {
		db = createMockDb();
	});

	describe('createMember', () => {
		it('should create a new member with required fields', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Test Singer',
				roles: ['librarian']
			});

			expect(member).toBeDefined();
			expect(member.id).toBeTruthy();
			expect(member.email).toBe('singer@choir.org');
			expect(member.name).toBe('Test Singer');
			expect(member.roles).toEqual(['librarian']);
		});

		it('should create member with admin role', async () => {
			const member = await createMember(db, {
				email: 'admin@choir.org',
				name: 'Choir Admin',
				roles: ['admin']
			});

			expect(member.roles).toContain('admin');
		});

		it('should track who invited the member', async () => {
			// First create an admin
			const admin = await createMember(db, {
				email: 'admin@choir.org',
				name: 'Admin',
				roles: ['admin']
			});

			// Then create a member invited by admin
			const singer = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian'],
				invited_by: admin.id
			});

			expect(singer.invited_by).toBe(admin.id);
		});
	});

	describe('getMemberByEmail', () => {
		it('should find member by email', async () => {
			await createMember(db, {
				email: 'find@choir.org',
				name: 'Find Me',
				roles: ['librarian']
			});

			const found = await getMemberByEmail(db, 'find@choir.org');
			expect(found).toBeDefined();
			expect(found?.email).toBe('find@choir.org');
		});

		it('should return null for unknown email', async () => {
			const found = await getMemberByEmail(db, 'unknown@choir.org');
			expect(found).toBeNull();
		});
	});

	describe('getMemberById', () => {
		it('should find member by id', async () => {
			const created = await createMember(db, {
				email: 'byid@choir.org',
				name: 'Find By ID',
				roles: ['librarian']
			});

			const found = await getMemberById(db, created.id);
			expect(found).toBeDefined();
			expect(found?.id).toBe(created.id);
		});

		it('should return null for unknown id', async () => {
			const found = await getMemberById(db, 'nonexistent-id');
			expect(found).toBeNull();
		});
	});
});
