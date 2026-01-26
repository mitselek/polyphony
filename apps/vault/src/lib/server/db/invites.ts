// Invite database operations for member invitation system

import type { Role, VoicePart } from '$lib/types';

export interface Invite {
	id: string;
	name: string; // Invitee name for tracking (not verified)
	token: string;
	invited_by: string;
	expires_at: string;
	status: 'pending' | 'accepted' | 'expired';
	roles: Role[]; // JSON array stored as string
	voice_part: VoicePart | null;
	created_at: string;
	accepted_at: string | null;
	accepted_by_email: string | null; // Registry-verified email (filled when accepted)
}

export interface CreateInviteInput {
	name: string;
	roles: Role[];
	invited_by: string;
	voice_part?: VoicePart;
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
	const rolesJson = JSON.stringify(input.roles);

	await db
		.prepare(
			`INSERT INTO invites (id, name, token, invited_by, expires_at, status, roles, voice_part, created_at)
			 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
		)
		.bind(
			id,
			input.name,
			token,
			input.invited_by,
			expiresAt.toISOString(),
			rolesJson,
			input.voice_part ?? null,
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
			`SELECT id, name, token, invited_by, expires_at, status, roles, voice_part, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE token = ?`
		)
		.bind(token)
		.first<{ roles: string } & Omit<Invite, 'roles'>>();

	if (!result) return null;

	// Parse roles JSON
	return {
		...result,
		roles: JSON.parse(result.roles) as Role[]
	};
}

/**
 * Find a pending invite by name
 */
export async function getInviteByName(
	db: D1Database,
	name: string
): Promise<Invite | null> {
	const result = await db
		.prepare(
			`SELECT id, name, token, invited_by, expires_at, status, roles, voice_part, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE name = ? AND status = 'pending'`
		)
		.bind(name)
		.first<{ roles: string } & Omit<Invite, 'roles'>>();

	if (!result) return null;

	// Parse roles JSON
	return {
		...result,
		roles: JSON.parse(result.roles) as Role[]
	};
}

/**
 * Accept an invite and create member (email from Registry OAuth)
 */
export async function acceptInvite(
	db: D1Database,
	token: string,
	email: string, // Verified email from Registry OAuth
	name?: string // Optional name from OAuth
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

	// Create member with multi-role support
	const memberId = generateId();
	await db
		.prepare(
			`INSERT INTO members (id, email, name, voice_part, invited_by)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(memberId, email, name ?? null, invite.voice_part, invite.invited_by)
		.run();

	// Insert roles from invite
	const roleStatements = invite.roles.map((role) =>
		db
			.prepare(
				'INSERT INTO member_roles (member_id, role, granted_by) VALUES (?, ?, ?)'
			)
			.bind(memberId, role, invite.invited_by)
	);
	await db.batch(roleStatements);

	// Mark invite as accepted with verified email
	await db
		.prepare(
			`UPDATE invites SET status = 'accepted', accepted_at = ?, accepted_by_email = ? WHERE token = ?`
		)
		.bind(now.toISOString(), email, token)
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
