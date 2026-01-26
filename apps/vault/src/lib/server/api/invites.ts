// Invite API handlers
import { createInvite, getInviteByName, type Invite } from '$lib/server/db/invites';
import { getMemberByEmail } from '$lib/server/db/members';
import type { Role, VoicePart } from '$lib/types';

export interface CreateInviteParams {
	db: D1Database;
	body: {
		name: string; // Invitee name for tracking
		roles: Role[]; // Can assign multiple roles
		voice_part?: VoicePart;
	};
	invitedBy: string;
}

export interface CreateInviteResult {
	success: boolean;
	invite?: Invite;
	error?: string;
}

/**
 * POST /api/members/invite - Create a new invitation link
 */
export async function POST(params: CreateInviteParams): Promise<CreateInviteResult> {
	const { db, body, invitedBy } = params;

	// Validate name
	if (!body.name || body.name.trim().length === 0) {
		return { success: false, error: 'Name is required' };
	}

	// Validate roles
	if (!body.roles || body.roles.length === 0) {
		return { success: false, error: 'At least one role is required' };
	}

	// Check if name already has pending invite
	const existingInvite = await getInviteByName(db, body.name);
	if (existingInvite) {
		return { success: false, error: 'Name already has a pending invite' };
	}

	// Create the invite
	const invite = await createInvite(db, {
		name: body.name,
		roles: body.roles,
		voice_part: body.voice_part,
		invited_by: invitedBy
	});

	return { success: true, invite };
}
