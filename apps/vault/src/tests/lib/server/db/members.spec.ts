// TDD: Member database operations tests
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from 'vitest';
import {
	createMember,
	getMemberByEmail,
	getMemberById,
	addMemberVoice,
	removeMemberVoice,
	addMemberSection,
	removeMemberSection
} from '../../../../lib/server/db/members.js';

// Mock D1 database with multi-role and voices/sections support
const createMockDb = () => {
	const members = new Map<
		string,
		{
			id: string;
			email: string;
			name: string | null;
			invited_by: string | null;
			joined_at: string;
		}
	>();
	const memberRoles = new Map<string, string[]>(); // member_id -> roles[]
	const memberVoices = new Map<string, { voice_id: string; is_primary: number }[]>(); // member_id -> voices
	const memberSections = new Map<string, { section_id: string; is_primary: number }[]>(); // member_id -> sections

	// Seed voices
	const voices = new Map([
		['soprano', { id: 'soprano', name: 'Soprano', abbreviation: 'S', category: 'vocal', range_group: 'soprano', display_order: 10, is_active: 1 }],
		['alto', { id: 'alto', name: 'Alto', abbreviation: 'A', category: 'vocal', range_group: 'alto', display_order: 20, is_active: 1 }],
		['tenor', { id: 'tenor', name: 'Tenor', abbreviation: 'T', category: 'vocal', range_group: 'tenor', display_order: 30, is_active: 1 }]
	]);

	// Seed sections
	const sections = new Map([
		['soprano', { id: 'soprano', name: 'Soprano', abbreviation: 'S', parent_section_id: null, display_order: 10, is_active: 1 }],
		['alto', { id: 'alto', name: 'Alto', abbreviation: 'A', parent_section_id: null, display_order: 20, is_active: 1 }],
		['tenor-1', { id: 'tenor-1', name: 'Tenor I', abbreviation: 'T1', parent_section_id: 'tenor', display_order: 31, is_active: 1 }]
	]);

	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					// INSERT INTO members
					if (sql.includes('INSERT INTO members')) {
						const [id, email, name, invited_by] = params as [
							string,
							string,
							string | null,
							string | null
						];
						members.set(id, { id, email, name, invited_by, joined_at: new Date().toISOString() });
						return { success: true, meta: { changes: 1 } };
					}
					// INSERT INTO member_roles
					if (sql.includes('INSERT INTO member_roles')) {
						const [member_id, role] = params as [string, string];
						const roles = memberRoles.get(member_id) || [];
						roles.push(role);
						memberRoles.set(member_id, roles);
						return { success: true };
					}
					// INSERT INTO member_voices
					if (sql.includes('INSERT INTO member_voices')) {
						const [member_id, voice_id, is_primary] = params as [string, string, number];
						const voiceList = memberVoices.get(member_id) || [];
						voiceList.push({ voice_id, is_primary });
						memberVoices.set(member_id, voiceList);
						return { success: true, meta: { changes: 1 } };
					}
					// INSERT INTO member_sections
					if (sql.includes('INSERT INTO member_sections')) {
						const [member_id, section_id, is_primary] = params as [string, string, number];
						const sectionList = memberSections.get(member_id) || [];
						sectionList.push({ section_id, is_primary });
						memberSections.set(member_id, sectionList);
						return { success: true, meta: { changes: 1 } };
					}
					// DELETE FROM member_voices
					if (sql.includes('DELETE FROM member_voices')) {
						const [member_id, voice_id] = params as [string, string];
						const voiceList = memberVoices.get(member_id) || [];
						memberVoices.set(
							member_id,
							voiceList.filter((v) => v.voice_id !== voice_id)
						);
						return { success: true, meta: { changes: 1 } };
					}
					// DELETE FROM member_sections
					if (sql.includes('DELETE FROM member_sections')) {
						const [member_id, section_id] = params as [string, string];
						const sectionList = memberSections.get(member_id) || [];
						memberSections.set(
							member_id,
							sectionList.filter((s) => s.section_id !== section_id)
						);
						return { success: true, meta: { changes: 1 } };
					}
					return { success: false, meta: { changes: 0 } };
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
						return { results: roles.map((role) => ({ role })) };
					}
					// SELECT voices for member (JOIN with voices table)
					if (sql.includes('FROM voices') && sql.includes('JOIN member_voices')) {
						const member_id = params[0] as string;
						const voiceList = memberVoices.get(member_id) || [];
						const results = voiceList.map((mv) => {
							const voice = voices.get(mv.voice_id);
							return voice ? { ...voice, is_primary: mv.is_primary } : null;
						}).filter(Boolean);
						return { results };
					}
					// SELECT sections for member (JOIN with sections table)
					if (sql.includes('FROM sections') && sql.includes('JOIN member_sections')) {
						const member_id = params[0] as string;
						const sectionList = memberSections.get(member_id) || [];
						const results = sectionList.map((ms) => {
							const section = sections.get(ms.section_id);
							return section ? { ...section, is_primary: ms.is_primary } : null;
						}).filter(Boolean);
						return { results };
					}
					return { results: [] };
				}
			})
		}),
		batch: async (statements: any[]) => {
			// Execute all statements (for role/voice/section insertion)
			const results = [];
			for (const stmt of statements) {
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
			expect(member.voices).toEqual([]);
			expect(member.sections).toEqual([]);
		});

		it('should create member with admin role', async () => {
			const member = await createMember(db, {
				email: 'admin@choir.org',
				name: 'Choir Admin',
				roles: ['admin']
			});

			expect(member.roles).toContain('admin');
		});

		it('should create member with voices', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian'],
				voiceIds: ['soprano', 'alto']
			});

			expect(member.voices).toHaveLength(2);
			expect(member.voices[0].id).toBe('soprano');
			expect(member.voices[1].id).toBe('alto');
		});

		it('should create member with sections', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian'],
				sectionIds: ['tenor-1']
			});

			expect(member.sections).toHaveLength(1);
			expect(member.sections[0].id).toBe('tenor-1');
		});

		it('should track who invited the member', async () => {
			const admin = await createMember(db, {
				email: 'admin@choir.org',
				name: 'Admin',
				roles: ['admin']
			});

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
		it('should find member by email with voices and sections', async () => {
			await createMember(db, {
				email: 'find@choir.org',
				name: 'Find Me',
				roles: ['librarian'],
				voiceIds: ['soprano'],
				sectionIds: ['soprano']
			});

			const found = await getMemberByEmail(db, 'find@choir.org');
			expect(found).toBeDefined();
			expect(found?.email).toBe('find@choir.org');
			expect(found?.voices).toHaveLength(1);
			expect(found?.sections).toHaveLength(1);
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

	describe('addMemberVoice', () => {
		it('should add a voice to a member', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian']
			});

			await addMemberVoice(db, member.id, 'soprano');
			const updated = await getMemberById(db, member.id);
			expect(updated?.voices).toHaveLength(1);
			expect(updated?.voices[0].id).toBe('soprano');
		});
	});

	describe('removeMemberVoice', () => {
		it('should remove a voice from a member', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian'],
				voiceIds: ['soprano', 'alto']
			});

			const result = await removeMemberVoice(db, member.id, 'soprano');
			expect(result).toBe(true);

			const updated = await getMemberById(db, member.id);
			expect(updated?.voices).toHaveLength(1);
			expect(updated?.voices[0].id).toBe('alto');
		});
	});

	describe('addMemberSection', () => {
		it('should add a section to a member', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian']
			});

			await addMemberSection(db, member.id, 'tenor-1');
			const updated = await getMemberById(db, member.id);
			expect(updated?.sections).toHaveLength(1);
			expect(updated?.sections[0].id).toBe('tenor-1');
		});
	});

	describe('removeMemberSection', () => {
		it('should remove a section from a member', async () => {
			const member = await createMember(db, {
				email: 'singer@choir.org',
				name: 'Singer',
				roles: ['librarian'],
				sectionIds: ['soprano', 'alto']
			});

			const result = await removeMemberSection(db, member.id, 'soprano');
			expect(result).toBe(true);

			const updated = await getMemberById(db, member.id);
			expect(updated?.sections).toHaveLength(1);
			expect(updated?.sections[0].id).toBe('alto');
		});
	});
});
