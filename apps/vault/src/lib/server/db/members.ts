// Member database operations

export interface Member {
	id: string;
	email: string;
	name: string | null;
	role: 'admin' | 'librarian' | 'singer';
	invited_by: string | null;
	joined_at: string;
}

export interface CreateMemberInput {
	email: string;
	name?: string;
	role: 'admin' | 'librarian' | 'singer';
	invited_by?: string;
}

// Simple ID generator (nanoid replacement for testing)
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new member in the database
 */
export async function createMember(
	db: D1Database,
	input: CreateMemberInput
): Promise<Member> {
	const id = generateId();
	const name = input.name ?? null;
	const invited_by = input.invited_by ?? null;

	await db
		.prepare(
			'INSERT INTO members (id, email, name, role, invited_by) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(id, input.email, name, input.role, invited_by)
		.run();

	// Return the created member
	const member = await getMemberById(db, id);
	if (!member) {
		throw new Error('Failed to create member');
	}
	return member;
}

/**
 * Find a member by email address
 */
export async function getMemberByEmail(
	db: D1Database,
	email: string
): Promise<Member | null> {
	const result = await db
		.prepare('SELECT id, email, name, role, invited_by, joined_at FROM members WHERE email = ?')
		.bind(email)
		.first<Member>();

	return result ?? null;
}

/**
 * Find a member by ID
 */
export async function getMemberById(
	db: D1Database,
	id: string
): Promise<Member | null> {
	const result = await db
		.prepare('SELECT id, email, name, role, invited_by, joined_at FROM members WHERE id = ?')
		.bind(id)
		.first<Member>();

	return result ?? null;
}
