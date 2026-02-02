// Member database operations
import type { Role, Voice, Section, Member } from '$lib/types';
import { queryMemberSections, queryMemberVoices } from './queries/members';
import { addMemberRoles } from './roles';

// Re-export Member from canonical types
export type { Member };

export interface CreateMemberInput {
	email: string; // For OAuth registration (becomes email_id)
	name?: string;
	roles: Role[]; // Can assign multiple roles on creation
	voiceIds?: string[]; // Voice IDs to assign
	sectionIds?: string[]; // Section IDs to assign
	invited_by?: string;
}

export interface CreateRosterMemberInput {
	name: string; // Required
	email_contact?: string; // Optional contact email
	voiceIds?: string[];
	sectionIds?: string[];
	addedBy: string; // Admin who added them
}

// Helper functions

/**
 * Check if member has completed OAuth registration
 */
export function isRegistered(member: Member): boolean {
	return member.email_id !== null;
}

/**
 * Get email for authentication (null for roster-only members)
 */
export function getAuthEmail(member: Member): string | null {
	return member.email_id;
}

/**
 * Get email for notifications (prefers contact, fallback to auth)
 */
export function getContactEmail(member: Member): string | null {
	return member.email_contact ?? member.email_id;
}

// Simple ID generator (nanoid replacement for testing)
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new member in the database with assigned roles, voices, and sections
 * For OAuth registration (has email_id)
 */
export async function createMember(db: D1Database, input: CreateMemberInput): Promise<Member> {
	const id = generateId();
	const name = input.name ?? input.email; // Default name to email
	const invited_by = input.invited_by ?? null;

	// Insert member record with email as email_id
	await db
		.prepare('INSERT INTO members (id, name, email_id, email_contact, invited_by) VALUES (?, ?, ?, NULL, ?)')
		.bind(id, name, input.email, invited_by)
		.run();

	// Insert role records using centralized function
	if (input.roles.length > 0) {
		await addMemberRoles(db, id, input.roles, invited_by);
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
 * Create a roster-only member (no OAuth registration yet)
 */
export async function createRosterMember(
	db: D1Database,
	input: CreateRosterMemberInput
): Promise<Member> {
	// Check name uniqueness (case-insensitive)
	const existing = await db
		.prepare('SELECT id FROM members WHERE LOWER(name) = LOWER(?)')
		.bind(input.name)
		.first();

	if (existing) {
		throw new Error(`Member with name "${input.name}" already exists`);
	}

	const id = generateId();

	// Insert member WITHOUT email_id (roster-only)
	await db
		.prepare('INSERT INTO members (id, name, email_id, email_contact, invited_by) VALUES (?, ?, NULL, ?, ?)')
		.bind(id, input.name, input.email_contact ?? null, input.addedBy)
		.run();

	// NO roles inserted (roster-only members can't have roles)

	// Insert voice assignments
	if (input.voiceIds && input.voiceIds.length > 0) {
		const voiceStatements = input.voiceIds.map((voiceId, index) =>
			db
				.prepare(
					'INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
				)
				.bind(id, voiceId, index === 0 ? 1 : 0, input.addedBy)
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
				.bind(id, sectionId, index === 0 ? 1 : 0, input.addedBy)
		);
		await db.batch(sectionStatements);
	}

	// Return the created member
	const member = await getMemberById(db, id);
	if (!member) {
		throw new Error('Failed to create roster member');
	}
	return member;
}

/**
 * Upgrade a roster-only member to registered (add email_id)
 */
export async function upgradeToRegistered(
	db: D1Database,
	rosterMemberId: string,
	verifiedEmailId: string
): Promise<Member> {
	// Verify no other member has this email_id
	const existingEmail = await getMemberByEmailId(db, verifiedEmailId);
	if (existingEmail && existingEmail.id !== rosterMemberId) {
		throw new Error('Email already registered to another member');
	}

	// Add email_id (upgrades roster → registered)
	await db
		.prepare('UPDATE members SET email_id = ? WHERE id = ?')
		.bind(verifiedEmailId, rosterMemberId)
		.run();

	const member = await getMemberById(db, rosterMemberId);
	if (!member) {
		throw new Error('Failed to upgrade roster member');
	}
	return member;
}

/**
 * Find a member by email_id (OAuth identity) with their roles, voices, and sections
 */
export async function getMemberByEmailId(db: D1Database, emailId: string): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, name, nickname, email_id, email_contact, invited_by, joined_at FROM members WHERE email_id = ?')
		.bind(emailId)
		.first<Omit<Member, 'roles' | 'voices' | 'sections'>>();

	if (!memberRow) {
		return null;
	}

	return await loadMemberRelations(db, memberRow);
}

/**
 * Find a member by name (case-insensitive) with their roles, voices, and sections
 */
export async function getMemberByName(db: D1Database, name: string): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, name, nickname, email_id, email_contact, invited_by, joined_at FROM members WHERE LOWER(name) = LOWER(?)')
		.bind(name)
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
		.prepare('SELECT id, name, nickname, email_id, email_contact, invited_by, joined_at FROM members WHERE id = ?')
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
		.prepare('SELECT id, name, nickname, email_id, email_contact, invited_by, joined_at FROM members')
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
 * Note: If this is the member's first voice, it's automatically marked as primary
 */
export async function addMemberVoice(
	db: D1Database,
	memberId: string,
	voiceId: string,
	isPrimary: boolean = false,
	assignedBy: string | null = null
): Promise<void> {
	// Enforce: first voice must be primary (don't trust caller)
	const existing = await db
		.prepare('SELECT COUNT(*) as count FROM member_voices WHERE member_id = ?')
		.bind(memberId)
		.first<{ count: number }>();
	
	const shouldBePrimary = isPrimary || (existing?.count ?? 0) === 0;
	
	await db
		.prepare(
			'INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
		)
		.bind(memberId, voiceId, shouldBePrimary ? 1 : 0, assignedBy)
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
 * Note: If this is the member's first section, it's automatically marked as primary
 */
export async function addMemberSection(
	db: D1Database,
	memberId: string,
	sectionId: string,
	isPrimary: boolean = false,
	assignedBy: string | null = null
): Promise<void> {
	// Enforce: first section must be primary (don't trust caller)
	const existing = await db
		.prepare('SELECT COUNT(*) as count FROM member_sections WHERE member_id = ?')
		.bind(memberId)
		.first<{ count: number }>();
	
	const shouldBePrimary = isPrimary || (existing?.count ?? 0) === 0;
	
	await db
		.prepare(
			'INSERT INTO member_sections (member_id, section_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
		)
		.bind(memberId, sectionId, shouldBePrimary ? 1 : 0, assignedBy)
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

/**
 * Update a member's name with uniqueness validation
 */
export async function updateMemberName(
	db: D1Database,
	memberId: string,
	newName: string
): Promise<Member> {
	// Check uniqueness (case-insensitive, excluding current member)
	const existing = await db
		.prepare('SELECT id FROM members WHERE LOWER(name) = LOWER(?) AND id != ?')
		.bind(newName, memberId)
		.first();

	if (existing) {
		throw new Error(`Member with name "${newName}" already exists`);
	}

	// Update name
	await db
		.prepare('UPDATE members SET name = ? WHERE id = ?')
		.bind(newName, memberId)
		.run();

	// Return updated member with all relations
	const updated = await getMemberById(db, memberId);
	if (!updated) {
		throw new Error('Failed to retrieve updated member');
	}

	return updated;
}

/**
 * Update a member's nickname (can be null to clear it)
 */
export async function updateMemberNickname(
	db: D1Database,
	memberId: string,
	newNickname: string | null
): Promise<Member> {
	// Update nickname (null clears it)
	await db
		.prepare('UPDATE members SET nickname = ? WHERE id = ?')
		.bind(newNickname, memberId)
		.run();

	// Return updated member with all relations
	const updated = await getMemberById(db, memberId);
	if (!updated) {
		throw new Error('Failed to retrieve updated member');
	}

	return updated;
}
