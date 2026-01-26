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

	try {
		// Import createInvite from DB operations
		const { createInvite } = await import('$lib/server/db/invites');

		// Create invite with roles, voices, and sections
		const invite = await createInvite(db, {
			name: body.name,
			roles: body.roles,
			voiceIds: body.voiceIds,
			sectionIds: body.sectionIds,
			invited_by: member.id
		});

		// Build invitation link
		const inviteLink = `${request.url.replace('/api/members/invite', '/invite/accept')}?token=${invite.token}`;

		return json(
			{
				id: invite.id,
				name: invite.name,
				roles: invite.roles,
				voices: invite.voices,
				sections: invite.sections,
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
