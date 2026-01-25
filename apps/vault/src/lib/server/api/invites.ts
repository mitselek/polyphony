// Invite API handlers
import { createInvite, getInviteByEmail, type Invite } from '$lib/server/db/invites';
import { getMemberByEmail } from '$lib/server/db/members';

export interface CreateInviteParams {
	db: D1Database;
	body: {
		email: string;
		role: 'admin' | 'librarian' | 'singer';
	};
	invitedBy: string;
}

export interface CreateInviteResult {
	success: boolean;
	invite?: Invite;
	error?: string;
}

const VALID_ROLES = ['admin', 'librarian', 'singer'];

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/members/invite - Create a new invitation
 */
export async function POST(params: CreateInviteParams): Promise<CreateInviteResult> {
	const { db, body, invitedBy } = params;

	// Validate email format
	if (!isValidEmail(body.email)) {
		return { success: false, error: 'Invalid email format' };
	}

	// Validate role
	if (!VALID_ROLES.includes(body.role)) {
		return { success: false, error: 'Invalid role' };
	}

	// Check if email is already a member
	const existingMember = await getMemberByEmail(db, body.email);
	if (existingMember) {
		return { success: false, error: 'Email is already a member' };
	}

	// Check if email already has pending invite
	const existingInvite = await getInviteByEmail(db, body.email);
	if (existingInvite) {
		return { success: false, error: 'Email already has a pending invite' };
	}

	// Create the invite
	const invite = await createInvite(db, {
		email: body.email,
		role: body.role,
		invited_by: invitedBy
	});

	return { success: true, invite };
}
