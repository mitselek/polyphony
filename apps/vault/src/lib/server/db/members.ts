// Member database operations
import type { Role, Voice, Section } from '$lib/types';
import { queryMemberSections, queryMemberVoices } from './queries/members';

export interface Member {
	id: string;
	email: string;
	name: string | null;
	roles: Role[]; // Multiple roles via junction table
	voices: Voice[]; // Member's vocal capabilities (what they CAN sing)
	sections: Section[]; // Member's current assignments (where they DO sing)
	invited_by: string | null;
	joined_at: string;
}

export interface CreateMemberInput {
	email: string;
	name?: string;
	roles: Role[]; // Can assign multiple roles on creation
	voiceIds?: string[]; // Voice IDs to assign
	sectionIds?: string[]; // Section IDs to assign
	invited_by?: string;
}

// Simple ID generator (nanoid replacement for testing)
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new member in the database with assigned roles, voices, and sections
 */
export async function createMember(db: D1Database, input: CreateMemberInput): Promise<Member> {
	const id = generateId();
	const name = input.name ?? null;
	const invited_by = input.invited_by ?? null;

	// Insert member record
	await db
		.prepare('INSERT INTO members (id, email, name, invited_by) VALUES (?, ?, ?, ?)')
		.bind(id, input.email, name, invited_by)
		.run();

	// Insert role records
	if (input.roles.length > 0) {
		const roleStatements = input.roles.map((role) =>
			db
				.prepare('INSERT INTO member_roles (member_id, role, granted_by) VALUES (?, ?, ?)')
				.bind(id, role, invited_by)
		);
		await db.batch(roleStatements);
	}

	// Insert voice assignments
	if (input.voiceIds && input.voiceIds.length > 0) {
		const voiceStatements = input.voiceIds.map((voiceId, index) =>
			db
				.prepare(
					'INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
				)
				.bind(id, voiceId, index === 0 ? 1 : 0, invited_by)
		);
		await db.batch(voiceStatements);
	}

	// Insert section assignments
	if (input.sectionIds && input.sectionIds.length > 0) {
		const sectionStatements = input.sectionIds.map((sectionId, index) =>
			db
				.prepare(
					'INSERT INTO member_sections (member_id, section_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
				)
				.bind(id, sectionId, index === 0 ? 1 : 0, invited_by)
		);
		await db.batch(sectionStatements);
	}

	// Return the created member
	const member = await getMemberById(db, id);
	if (!member) {
		throw new Error('Failed to create member');
	}
	return member;
}

/**
 * Find a member by email address with their roles, voices, and sections
 */
export async function getMemberByEmail(db: D1Database, email: string): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, email, name, invited_by, joined_at FROM members WHERE email = ?')
		.bind(email)
		.first<Omit<Member, 'roles' | 'voices' | 'sections'>>();

	if (!memberRow) {
		return null;
	}

	return await loadMemberRelations(db, memberRow);
}

/**
 * Find a member by ID with their roles, voices, and sections
 */
export async function getMemberById(db: D1Database, id: string): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, email, name, invited_by, joined_at FROM members WHERE id = ?')
		.bind(id)
		.first<Omit<Member, 'roles' | 'voices' | 'sections'>>();

	if (!memberRow) {
		return null;
	}

	return await loadMemberRelations(db, memberRow);
}

/**
 * Get all members with their roles, voices, and sections
 */
export async function getAllMembers(db: D1Database): Promise<Member[]> {
	const { results: memberRows } = await db
		.prepare('SELECT id, email, name, invited_by, joined_at FROM members')
		.all<Omit<Member, 'roles' | 'voices' | 'sections'>>();

	// Load relations for all members
	const membersWithRelations = await Promise.all(
		memberRows.map((memberRow) => loadMemberRelations(db, memberRow))
	);

	return membersWithRelations;
}

/**
 * Helper function to load roles, voices, and sections for a member
 */
async function loadMemberRelations(
	db: D1Database,
	memberRow: Omit<Member, 'roles' | 'voices' | 'sections'>
): Promise<Member> {
	// Get roles
	const rolesResult = await db
		.prepare('SELECT role FROM member_roles WHERE member_id = ?')
		.bind(memberRow.id)
		.all<{ role: Role }>();
	const roles = rolesResult.results.map((r) => r.role);

	// Get voices and sections using shared queries
	const voices = await queryMemberVoices(db, memberRow.id);
	const sections = await queryMemberSections(db, memberRow.id);

	return {
		...memberRow,
		roles,
		voices,
		sections
	};
}

/**
 * Add a voice to a member
 */
export async function addMemberVoice(
	db: D1Database,
	memberId: string,
	voiceId: string,
	isPrimary: boolean = false,
	assignedBy: string | null = null
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
		)
		.bind(memberId, voiceId, isPrimary ? 1 : 0, assignedBy)
		.run();
}

/**
 * Remove a voice from a member
 */
export async function removeMemberVoice(
	db: D1Database,
	memberId: string,
	voiceId: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM member_voices WHERE member_id = ? AND voice_id = ?')
		.bind(memberId, voiceId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Set primary voice for a member (others become non-primary)
 */
export async function setPrimaryVoice(
	db: D1Database,
	memberId: string,
	voiceId: string
): Promise<void> {
	await db
		.prepare('UPDATE member_voices SET is_primary = ? WHERE member_id = ? AND voice_id = ?')
		.bind(1, memberId, voiceId)
		.run();
}

/**
 * Add a section to a member
 */
export async function addMemberSection(
	db: D1Database,
	memberId: string,
	sectionId: string,
	isPrimary: boolean = false,
	assignedBy: string | null = null
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO member_sections (member_id, section_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
		)
		.bind(memberId, sectionId, isPrimary ? 1 : 0, assignedBy)
		.run();
}

/**
 * Remove a section from a member
 */
export async function removeMemberSection(
	db: D1Database,
	memberId: string,
	sectionId: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM member_sections WHERE member_id = ? AND section_id = ?')
		.bind(memberId, sectionId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Set primary section for a member (others become non-primary)
 */
export async function setPrimarySection(
	db: D1Database,
	memberId: string,
	sectionId: string
): Promise<void> {
	await db
		.prepare('UPDATE member_sections SET is_primary = ? WHERE member_id = ? AND section_id = ?')
		.bind(1, memberId, sectionId)
		.run();
}
