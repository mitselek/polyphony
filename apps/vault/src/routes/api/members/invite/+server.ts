// POST /api/members/invite - Create a new member invitation
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedMember, assertAdmin, isOwner } from '$lib/server/auth/middleware';
import { parseBody, createInviteSchema } from '$lib/server/validation/schemas';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Validate request body with Zod
	const body = await parseBody(request, createInviteSchema);

	// Only owners can invite owners
	if (body.roles.includes('owner') && !isOwner(member)) {
		throw error(403, 'Only owners can invite other owners');
	}

	// Generate invitation token
	const token = crypto.randomUUID();
	const inviteId = crypto.randomUUID();

	try {
		// Create invite record with roles
		// TODO Phase 3: Add support for inviting with specific voices/sections
		await db
			.prepare(
				`INSERT INTO invites (id, name, token, invited_by, expires_at, roles)
				 VALUES (?, ?, ?, ?, datetime('now', '+48 hours'), ?)`
			)
			.bind(
				inviteId,
				body.name,
				token,
				member.id,
				JSON.stringify(body.roles)
			)
			.run();

		// TODO: Send email with invitation link containing token
		const inviteLink = `${request.url.replace('/api/members/invite', '/invite/accept')}?token=${token}`;

		return json(
			{
				id: inviteId,
				name: body.name,
				roles: body.roles,
				inviteLink,
				message: `Invitation created. Share the link with ${body.name}.`
			},
			{ status: 201 }
		);
	} catch (err) {
		console.error('Failed to create invite:', err);
		throw error(500, 'Failed to create invite');
	}
};
