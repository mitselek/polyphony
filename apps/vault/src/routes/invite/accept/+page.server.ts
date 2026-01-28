import { redirect, error, type RequestEvent } from '@sveltejs/kit';

export async function load({ url, platform }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Invalid invitation link');
	}

	// Validate token and check expiration
	// Note: Production schema doesn't have status/roles columns
	const invite = await db
		.prepare(
			`SELECT id, roster_member_id, expires_at
			 FROM invites
			 WHERE token = ?`
		)
		.bind(token)
		.first<{
			id: string;
			roster_member_id: string;
			expires_at: string;
		}>();

	if (!invite) {
		throw error(404, 'Invitation not found');
	}

	const now = new Date();
	const expiresAt = new Date(invite.expires_at);
	if (now > expiresAt) {
		throw error(400, 'This invitation has expired');
	}

	// Check if roster member is already registered
	const rosterMember = await db
		.prepare('SELECT email_id FROM members WHERE id = ?')
		.bind(invite.roster_member_id)
		.first<{ email_id: string | null }>();

	if (rosterMember?.email_id) {
		throw error(400, 'This invitation has already been used');
	}

	// Redirect to auth/login with invite token parameter
	// The login endpoint will pass it through the OAuth flow
	throw redirect(302, `/api/auth/login?invite=${encodeURIComponent(token)}`);
};
