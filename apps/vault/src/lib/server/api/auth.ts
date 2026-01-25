// Auth API handlers (accept invite, session management)
import { acceptInvite } from '$lib/server/db/invites';

export interface AcceptInviteParams {
	db: D1Database;
	token: string;
}

export interface AcceptInviteResult {
	success: boolean;
	memberId?: string;
	error?: string;
}

/**
 * GET /api/auth/accept - Accept an invitation token
 */
export async function GET(params: AcceptInviteParams): Promise<AcceptInviteResult> {
	const { db, token } = params;

	return await acceptInvite(db, token);
}
