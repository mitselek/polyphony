// POST /api/members/invite - Create a new member invitation
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { POST as createInvite } from '$lib/server/api/invites';
import { requireAdmin } from '$lib/server/auth/middleware';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');

	// Require at least admin role to invite members
	const auth = await requireAdmin({ db, memberId });
	if (!auth.authorized) {
		throw error(auth.status ?? 401, auth.error ?? 'Unauthorized');
	}

	let body: { email: string; role: 'admin' | 'librarian' | 'singer' };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.email || !body.role) {
		throw error(400, 'Email and role are required');
	}

	const result = await createInvite({
		db,
		body: { email: body.email, role: body.role },
		invitedBy: auth.member!.id
	});

	if (!result.success) {
		throw error(400, result.error ?? 'Failed to create invite');
	}

	return json({
		id: result.invite!.id,
		email: result.invite!.email,
		role: result.invite!.role,
		expires_at: result.invite!.expires_at,
		// Don't expose the token in API response - send via email
		message: 'Invitation created. Email will be sent to the recipient.'
	}, { status: 201 });
};
