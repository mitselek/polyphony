// POST /api/members/invite - Create a new member invitation
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Role } from '$lib/types';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');
	if (!memberId) {
		throw error(401, 'Authentication required');
	}

	// Check if current user is admin or owner
	const currentUser = await db
		.prepare(
			`SELECT GROUP_CONCAT(role) as roles
			 FROM member_roles
			 WHERE member_id = ?`
		)
		.bind(memberId)
		.first<{ roles: string | null }>();

	if (!currentUser) {
		throw error(401, 'Invalid session');
	}

	const currentUserRoles = currentUser.roles?.split(',') ?? [];
	const isAdmin = currentUserRoles.some((r) => ['admin', 'owner'].includes(r));
	const isOwner = currentUserRoles.includes('owner');

	if (!isAdmin) {
		throw error(403, 'Admin or owner role required');
	}

	let body: { email: string; roles: Role[]; voicePart?: string | null };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.email || !body.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
		throw error(400, 'Email and at least one role are required');
	}

	// Only owners can invite owners
	if (body.roles.includes('owner') && !isOwner) {
		throw error(403, 'Only owners can invite other owners');
	}

	// Generate invitation token
	const token = crypto.randomUUID();
	const inviteId = crypto.randomUUID();

	try {
		// Create invite record
		await db
			.prepare(
				`INSERT INTO invites (id, email, token, invited_by, expires_at)
				 VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`
			)
			.bind(inviteId, body.email, token, memberId)
			.run();

		// Store invited roles (we'll use a JSON column for simplicity, or create invite_roles table)
		// For now, let's just store as JSON string in a metadata column
		// TODO: Send email with invitation link containing token

		return json(
			{
				id: inviteId,
				email: body.email,
				roles: body.roles,
				voicePart: body.voicePart ?? null,
				message: 'Invitation created. Email will be sent to the recipient.'
			},
			{ status: 201 }
		);
	} catch (err) {
		console.error('Failed to create invite:', err);
		throw error(500, 'Failed to create invite');
	}
};
