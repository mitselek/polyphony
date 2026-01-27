// Invite database operations for member invitation system

import type { Role, Voice, Section } from '$lib/types';

export interface Invite {
	id: string;
	name: string; // Invitee name for tracking (not verified)
	token: string;
	invited_by: string;
	expires_at: string;
	status: 'pending' | 'accepted'; // 'expired' derived from expires_at < now()
	roles: Role[]; // JSON array stored as string
	voices: Voice[]; // Invited voices (from junction table)
	sections: Section[]; // Invited sections (from junction table)
	created_at: string;
	accepted_at: string | null;
	accepted_by_email: string | null; // Registry-verified email (filled when accepted)
}

export interface CreateInviteInput {
	name: string;
	roles: Role[];
	invited_by: string;
	voiceIds?: string[];
	sectionIds?: string[];
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
			`INSERT INTO invites (id, name, token, invited_by, expires_at, status, roles, created_at)
			 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
		)
		.bind(
			id,
			input.name,
			token,
			input.invited_by,
			expiresAt.toISOString(),
			rolesJson,
			now.toISOString()
		)
		.run();

	// Insert voice assignments
	if (input.voiceIds && input.voiceIds.length > 0) {
		const voiceStatements = input.voiceIds.map((voiceId, index) =>
			db
				.prepare(
					'INSERT INTO invite_voices (invite_id, voice_id, is_primary) VALUES (?, ?, ?)'
				)
				.bind(id, voiceId, index === 0 ? 1 : 0)
		);
		await db.batch(voiceStatements);
	}

	// Insert section assignments
	if (input.sectionIds && input.sectionIds.length > 0) {
		const sectionStatements = input.sectionIds.map((sectionId, index) =>
			db
				.prepare(
					'INSERT INTO invite_sections (invite_id, section_id, is_primary) VALUES (?, ?, ?)'
				)
				.bind(id, sectionId, index === 0 ? 1 : 0)
		);
		await db.batch(sectionStatements);
	}

	const invite = await getInviteByToken(db, token);
	if (!invite) {
		throw new Error('Failed to create invite');
	}
	return invite;
}

/**
 * Helper to load voices and sections for an invite
 */
async function loadInviteRelations(
	db: D1Database,
	inviteRow: Omit<Invite, 'roles' | 'voices' | 'sections'> & { roles: string }
): Promise<Invite> {
	// Parse roles JSON
	const roles = JSON.parse(inviteRow.roles) as Role[];

	// Define interface for voice query result
	interface VoiceRow {
		id: string;
		name: string;
		abbreviation: string;
		category: 'vocal' | 'instrumental';
		range_group: string | null;
		display_order: number;
		is_active: number;
	}

	// Get voices
	const voicesResult = await db
		.prepare(
			`SELECT v.id, v.name, v.abbreviation, v.category, v.range_group, v.display_order, v.is_active
			 FROM voices v
			 JOIN invite_voices iv ON v.id = iv.voice_id
			 WHERE iv.invite_id = ?
			 ORDER BY iv.is_primary DESC, v.display_order ASC`
		)
		.bind(inviteRow.id)
		.all<VoiceRow>();

	const voices: Voice[] = voicesResult.results.map((row) => ({
		id: row.id,
		name: row.name,
		abbreviation: row.abbreviation,
		category: row.category,
		rangeGroup: row.range_group,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	}));

	// Define interface for section query result
	interface SectionRow {
		id: string;
		name: string;
		abbreviation: string;
		parent_section_id: string | null;
		display_order: number;
		is_active: number;
	}

	// Get sections
	const sectionsResult = await db
		.prepare(
			`SELECT s.id, s.name, s.abbreviation, s.parent_section_id, s.display_order, s.is_active
			 FROM sections s
			 JOIN invite_sections isc ON s.id = isc.section_id
			 WHERE isc.invite_id = ?
			 ORDER BY isc.is_primary DESC, s.display_order ASC`
		)
		.bind(inviteRow.id)
		.all<SectionRow>();

	const sections: Section[] = sectionsResult.results.map((row) => ({
		id: row.id,
		name: row.name,
		abbreviation: row.abbreviation,
		parentSectionId: row.parent_section_id,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	}));

	return {
		...inviteRow,
		roles,
		voices,
		sections
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
			`SELECT id, name, token, invited_by, expires_at, status, roles, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE token = ?`
		)
		.bind(token)
		.first<{ roles: string } & Omit<Invite, 'roles' | 'voices' | 'sections'>>();

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
			`SELECT id, name, token, invited_by, expires_at, status, roles, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE id = ?`
		)
		.bind(inviteId)
		.first<{ roles: string } & Omit<Invite, 'roles' | 'voices' | 'sections'>>();

	if (!result) return null;

	return await loadInviteRelations(db, result);
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
			`SELECT id, name, token, invited_by, expires_at, status, roles, created_at, accepted_at, accepted_by_email
			 FROM invites WHERE name = ? AND status = 'pending'`
		)
		.bind(name)
		.first<{ roles: string } & Omit<Invite, 'roles' | 'voices' | 'sections'>>();

	if (!result) return null;

	return await loadInviteRelations(db, result);
}

/**
 * Accept an invite and create member (email from Registry OAuth)
 * Transfers roles, voices, and sections from invite to new member
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

	// Check if expired by time (derived from expires_at)
	const now = new Date();
	const expiresAt = new Date(invite.expires_at);
	if (now > expiresAt) {
		return { success: false, error: 'Invite has expired' };
	}

	// Create member record
	const memberId = generateId();
	await db
		.prepare(
			`INSERT INTO members (id, email, name, invited_by)
			 VALUES (?, ?, ?, ?)`
		)
		.bind(memberId, email, name ?? null, invite.invited_by)
		.run();

	// Insert roles from invite
	if (invite.roles.length > 0) {
		const roleStatements = invite.roles.map((role) =>
			db
				.prepare(
					'INSERT INTO member_roles (member_id, role, granted_by) VALUES (?, ?, ?)'
				)
				.bind(memberId, role, invite.invited_by)
		);
		await db.batch(roleStatements);
	}

	// Transfer voices from invite to member
	if (invite.voices.length > 0) {
		const voiceStatements = invite.voices.map((voice, index) =>
			db
				.prepare(
					'INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
				)
				.bind(memberId, voice.id, index === 0 ? 1 : 0, invite.invited_by)
		);
		await db.batch(voiceStatements);
	}

	// Transfer sections from invite to member
	if (invite.sections.length > 0) {
		const sectionStatements = invite.sections.map((section, index) =>
			db
				.prepare(
					'INSERT INTO member_sections (member_id, section_id, is_primary, assigned_by) VALUES (?, ?, ?, ?)'
				)
				.bind(memberId, section.id, index === 0 ? 1 : 0, invite.invited_by)
		);
		await db.batch(sectionStatements);
	}

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
 * Get all pending invites with inviter info
 */
export async function getPendingInvites(
	db: D1Database
): Promise<(Invite & { inviter_name: string | null; inviter_email: string })[]> {
	const result = await db
		.prepare(
			`SELECT i.id, i.name, i.token, i.invited_by, i.expires_at, i.status, i.roles, i.created_at, i.accepted_at, i.accepted_by_email,
			        m.name as inviter_name, m.email as inviter_email
			 FROM invites i
			 JOIN members m ON i.invited_by = m.id
			 WHERE datetime('now') < i.expires_at
			 ORDER BY i.created_at DESC`
		)
		.all<{ inviter_name: string | null; inviter_email: string; roles: string } & Omit<Invite, 'roles' | 'voices' | 'sections'>>();

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
