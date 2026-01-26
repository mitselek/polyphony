// Member database operations
import type { Role, VoicePart } from '$lib/types';

export interface Member {
	id: string;
	email: string;
	name: string | null;
	roles: Role[]; // Multiple roles via junction table
	voice_part: VoicePart | null;
	invited_by: string | null;
	joined_at: string;
}

export interface CreateMemberInput {
	email: string;
	name?: string;
	roles: Role[]; // Can assign multiple roles on creation
	voice_part?: VoicePart;
	invited_by?: string;
}

// Simple ID generator (nanoid replacement for testing)
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new member in the database with assigned roles
 */
export async function createMember(
	db: D1Database,
	input: CreateMemberInput
): Promise<Member> {
	const id = generateId();
	const name = input.name ?? null;
	const invited_by = input.invited_by ?? null;
	const voice_part = input.voice_part ?? null;

	// Insert member record
	await db
		.prepare(
			'INSERT INTO members (id, email, name, voice_part, invited_by) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(id, input.email, name, voice_part, invited_by)
		.run();

	// Insert role records
	const roleStatements = input.roles.map((role) =>
		db
			.prepare(
				'INSERT INTO member_roles (member_id, role, granted_by) VALUES (?, ?, ?)'
			)
			.bind(id, role, invited_by)
	);
	await db.batch(roleStatements);

	// Return the created member
	const member = await getMemberById(db, id);
	if (!member) {
		throw new Error('Failed to create member');
	}
	return member;
}

/**
 * Find a member by email address with their roles
 */
export async function getMemberByEmail(
	db: D1Database,
	email: string
): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, email, name, voice_part, invited_by, joined_at FROM members WHERE email = ?')
		.bind(email)
		.first<Omit<Member, 'roles'>>();

	if (!memberRow) {
		return null;
	}

	// Get roles from junction table
	const rolesResult = await db
		.prepare('SELECT role FROM member_roles WHERE member_id = ?')
		.bind(memberRow.id)
		.all<{ role: Role }>();

	const roles = rolesResult.results.map((r) => r.role);

	return { ...memberRow, roles };
}

/**
 * Find a member by ID with their roles
 */
export async function getMemberById(
	db: D1Database,
	id: string
): Promise<Member | null> {
	const memberRow = await db
		.prepare('SELECT id, email, name, voice_part, invited_by, joined_at FROM members WHERE id = ?')
		.bind(id)
		.first<Omit<Member, 'roles'>>();

	if (!memberRow) {
		return null;
	}

	// Get roles from junction table
	const rolesResult = await db
		.prepare('SELECT role FROM member_roles WHERE member_id = ?')
		.bind(memberRow.id)
		.all<{ role: Role }>();

	const roles = rolesResult.results.map((r) => r.role);

	return { ...memberRow, roles };
}

/**
 * Get all members with their roles
 */
export async function getAllMembers(db: D1Database): Promise<Member[]> {
	const { results: memberRows } = await db
		.prepare('SELECT id, email, name, voice_part, invited_by, joined_at FROM members')
		.all<Omit<Member, 'roles'>>();

	// Get roles for all members efficiently
	const membersWithRoles = await Promise.all(
		memberRows.map(async (memberRow) => {
			const rolesResult = await db
				.prepare('SELECT role FROM member_roles WHERE member_id = ?')
				.bind(memberRow.id)
				.all<{ role: Role }>();

			const roles = rolesResult.results.map((r) => r.role);
			return { ...memberRow, roles };
		})
	);

	return membersWithRoles;
}
