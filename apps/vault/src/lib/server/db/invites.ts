// Invite database operations for member invitation system

export interface Invite {
	id: string;
	email: string;
	role: 'admin' | 'librarian' | 'singer';
	token: string;
	invited_by: string;
	expires_at: string;
	status: 'pending' | 'accepted' | 'expired';
	created_at: string;
	accepted_at: string | null;
}

export interface CreateInviteInput {
	email: string;
	role: 'admin' | 'librarian' | 'singer';
	invited_by: string;
}

export interface AcceptInviteResult {
	success: boolean;
	memberId?: string;
	error?: string;
}

// Token expiry in hours
const INVITE_EXPIRY_HOURS = 48;

// Generate secure random token
function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Simple ID generator
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new invite
 */
export async function createInvite(
	db: D1Database,
	input: CreateInviteInput
): Promise<Invite> {
	const id = generateId();
	const token = generateToken();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

	await db
		.prepare(
			`INSERT INTO invites (id, email, role, token, invited_by, expires_at, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
		)
		.bind(
			id,
			input.email,
			input.role,
			token,
			input.invited_by,
			expiresAt.toISOString(),
			now.toISOString()
		)
		.run();

	const invite = await getInviteByToken(db, token);
	if (!invite) {
		throw new Error('Failed to create invite');
	}
	return invite;
}

/**
 * Find an invite by token
 */
export async function getInviteByToken(
	db: D1Database,
	token: string
): Promise<Invite | null> {
	const result = await db
		.prepare(
			`SELECT id, email, role, token, invited_by, expires_at, status, created_at, accepted_at
			 FROM invites WHERE token = ?`
		)
		.bind(token)
		.first<Invite>();

	return result ?? null;
}

/**
 * Find a pending invite by email
 */
export async function getInviteByEmail(
	db: D1Database,
	email: string
): Promise<Invite | null> {
	const result = await db
		.prepare(
			`SELECT id, email, role, token, invited_by, expires_at, status, created_at, accepted_at
			 FROM invites WHERE email = ? AND status = 'pending'`
		)
		.bind(email)
		.first<Invite>();

	return result ?? null;
}

/**
 * Accept an invite and create member
 */
export async function acceptInvite(
	db: D1Database,
	token: string
): Promise<AcceptInviteResult> {
	const invite = await getInviteByToken(db, token);

	if (!invite) {
		return { success: false, error: 'Invalid invite token' };
	}

	if (invite.status === 'accepted') {
		return { success: false, error: 'Invite already used' };
	}

	if (invite.status === 'expired') {
		return { success: false, error: 'Invite has expired' };
	}

	// Check if expired by time
	const now = new Date();
	const expiresAt = new Date(invite.expires_at);
	if (now > expiresAt) {
		// Mark as expired
		await db
			.prepare(`UPDATE invites SET status = 'expired' WHERE token = ?`)
			.bind(token)
			.run();
		return { success: false, error: 'Invite has expired' };
	}

	// Create member
	const memberId = generateId();
	await db
		.prepare(
			`INSERT INTO members (id, email, name, role, invited_by)
			 VALUES (?, ?, NULL, ?, ?)`
		)
		.bind(memberId, invite.email, invite.role, invite.invited_by)
		.run();

	// Mark invite as accepted
	await db
		.prepare(
			`UPDATE invites SET status = 'accepted', accepted_at = ? WHERE token = ?`
		)
		.bind(now.toISOString(), token)
		.run();

	return { success: true, memberId };
}

/**
 * Mark an invite as expired
 */
export async function expireInvite(
	db: D1Database,
	token: string
): Promise<boolean> {
	const result = await db
		.prepare(`UPDATE invites SET status = 'expired' WHERE token = ?`)
		.bind(token)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
