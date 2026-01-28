// Invite database operations for member invitation system

import type { Role, Voice, Section } from '$lib/types';

export interface Invite {
	id: string;
	roster_member_id: string; // Links to roster member
	roster_member_name: string; // For display (from JOIN)
	token: string;
	invited_by: string;
	expires_at: string;
	status: 'pending' | 'accepted'; // 'expired' derived from expires_at < now()
	roles: Role[]; // Roles to assign upon acceptance
	voices: Voice[]; // Inherited from roster member (display only)
	sections: Section[]; // Inherited from roster member (display only)
	email_hint?: string; // Optional: suggested email for Registry
	created_at: string;
	accepted_at: string | null;
	accepted_by_email: string | null; // Registry-verified email (filled when accepted)
}

export interface CreateInviteInput {
	rosterMemberId: string; // Required: which roster member to invite
	roles: Role[]; // Roles to grant upon acceptance
	invited_by: string;
	emailHint?: string; // Optional: suggested email for Registry
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
 * Create a new invite linked to a roster member
 */
export async function createInvite(
	db: D1Database,
	input: CreateInviteInput
): Promise<Invite> {
	// 1. Verify roster member exists
	const { getMemberById } = await import('./members');
	const rosterMember = await getMemberById(db, input.rosterMemberId);
	if (!rosterMember) {
		throw new Error('Roster member not found');
	}

	// 2. Verify member is not already registered
	if (rosterMember.email_id) {
		throw new Error('Member is already registered');
	}

	// 3. Check for existing pending invite
	const existingInvite = await db
		.prepare('SELECT id FROM invites WHERE roster_member_id = ? AND status = "pending"')
		.bind(input.rosterMemberId)
		.first();
	if (existingInvite) {
		throw new Error('Member already has a pending invitation');
	}

	// 4. Create invite linked to roster member
	const id = generateId();
	const token = generateToken();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
	const rolesJson = JSON.stringify(input.roles);

	await db
		.prepare(
			`INSERT INTO invites (id, roster_member_id, token, invited_by, expires_at, status, roles, email_hint, created_at)
			 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
		)
		.bind(
			id,
			input.rosterMemberId,
			token,
			input.invited_by,
			expiresAt.toISOString(),
			rolesJson,
			input.emailHint ?? null,
			now.toISOString()
		)
		.run();

	const invite = await getInviteById(db, id);
	if (!invite) {
		throw new Error('Failed to create invite');
	}
	return invite;
}

/**
 * Helper to load roster member, voices, and sections for an invite
 */
async function loadInviteRelations(
	db: D1Database,
	inviteRow: Omit<Invite, 'roles' | 'voices' | 'sections' | 'roster_member_name' | 'email_hint'> & { roles: string; email_hint: string | null }
): Promise<Invite> {
	// Parse roles JSON
	const roles = JSON.parse(inviteRow.roles) as Role[];

	// Get roster member to load name, voices, and sections
	const { getMemberById } = await import('./members');
	const rosterMember = await getMemberById(db, inviteRow.roster_member_id);
	
	// Handle missing roster member - use email_hint as fallback name
	const memberName = rosterMember?.name ?? (inviteRow.email_hint?.split('@')[0] ?? 'Unknown Member');
	const memberVoices = rosterMember?.voices ?? [];
	const memberSections = rosterMember?.sections ?? [];

	// Build result with proper type conversions (null → undefined for email_hint)
	const { email_hint, ...restRow } = inviteRow;
	return {
		...restRow,
		roster_member_name: memberName,
		roles,
		voices: memberVoices,
		sections: memberSections,
		...(email_hint !== null && { email_hint }) // Only add if not null
	};
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
			`SELECT id, roster_member_id, token, invited_by, expires_at, status, roles, email_hint, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE token = ?`
		)
		.bind(token)
		.first<{ roles: string; email_hint: string | null } & Omit<Invite, 'roles' | 'voices' | 'sections' | 'roster_member_name' | 'email_hint'>>();

	if (!result) return null;

	return await loadInviteRelations(db, result);
}

/**
 * Find invite by ID
 */
export async function getInviteById(
	db: D1Database,
	inviteId: string
): Promise<Invite | null> {
	const result = await db
		.prepare(
			`SELECT id, roster_member_id, token, invited_by, expires_at, status, roles, email_hint, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE id = ?`
		)
		.bind(inviteId)
		.first<{ roles: string; email_hint: string | null } & Omit<Invite, 'roles' | 'voices' | 'sections' | 'roster_member_name' | 'email_hint'>>();

	if (!result) return null;

	return await loadInviteRelations(db, result);
}

/**
 * Accept an invite and upgrade roster member to registered
 * Transfers roles from invite to member
 */
export async function acceptInvite(
	db: D1Database,
	token: string,
	email: string // Verified email from Registry OAuth
): Promise<AcceptInviteResult> {
	const invite = await getInviteByToken(db, token);

	if (!invite) {
		return { success: false, error: 'Invalid invite token' };
	}

	if (invite.status === 'accepted') {
		return { success: false, error: 'Invite already used' };
	}

	// Check if expired by time (derived from expires_at)
	const now = new Date();
	const expiresAt = new Date(invite.expires_at);
	if (now > expiresAt) {
		return { success: false, error: 'Invite has expired' };
	}

	// Upgrade roster member to registered
	const { upgradeToRegistered } = await import('./members');
	const member = await upgradeToRegistered(
		db,
		invite.roster_member_id,
		email
	);

	// Transfer roles from invite to member
	if (invite.roles.length > 0) {
		const roleStatements = invite.roles.map((role) =>
			db
				.prepare(
					'INSERT INTO member_roles (member_id, role, granted_by) VALUES (?, ?, ?)'
				)
				.bind(member.id, role, invite.invited_by)
		);
		await db.batch(roleStatements);
	}

	// Mark invite as accepted with verified email
	await db
		.prepare(
			`UPDATE invites SET status = 'accepted', accepted_at = ?, accepted_by_email = ? WHERE token = ?`
		)
		.bind(now.toISOString(), email, token)
		.run();

	return { success: true, memberId: member.id };
}

/**
 * Get all pending invites with roster member and inviter info
 */
export async function getPendingInvites(
	db: D1Database
): Promise<(Invite & { inviter_name: string | null; inviter_email: string | null })[]> {
	const result = await db
		.prepare(
			`SELECT i.id, i.roster_member_id, i.token, i.invited_by, i.expires_at, i.status, i.roles, i.email_hint, i.created_at, i.accepted_at, i.accepted_by_email,
			        inviter.name as inviter_name, inviter.email_id as inviter_email
			 FROM invites i
			 JOIN members inviter ON i.invited_by = inviter.id
			 WHERE i.status = 'pending'
			 ORDER BY i.created_at DESC`
		)
		.all<{ inviter_name: string | null; inviter_email: string | null; roles: string; email_hint: string | null } & Omit<Invite, 'roles' | 'voices' | 'sections' | 'roster_member_name' | 'email_hint'>>();

	// Load relations for each invite
	const invitesWithRelations = await Promise.all(
		result.results.map(async (row) => {
			const invite = await loadInviteRelations(db, row);
			return {
				...invite,
				inviter_name: row.inviter_name,
				inviter_email: row.inviter_email
			};
		})
	);

	return invitesWithRelations;
}

/**
 * Revoke (delete) an invite by ID
 */
export async function revokeInvite(
	db: D1Database,
	inviteId: string
): Promise<boolean> {
	const result = await db
		.prepare(`DELETE FROM invites WHERE id = ? AND status = 'pending'`)
		.bind(inviteId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Renew an invite by extending expiration by 48 hours from now
 */
export async function renewInvite(
	db: D1Database,
	inviteId: string
): Promise<Invite | null> {
	const newExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

	const result = await db
		.prepare(
			`UPDATE invites 
			 SET expires_at = ? 
			 WHERE id = ? AND status = 'pending'`
		)
		.bind(newExpiresAt.toISOString(), inviteId)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	return getInviteById(db, inviteId);
}
