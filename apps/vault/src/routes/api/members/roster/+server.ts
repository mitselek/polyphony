// API endpoint for creating roster-only members
// POST /api/members/roster
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { createRosterMember } from '$lib/server/db/members';

interface CreateRosterMemberRequest {
	name: string;
	emailContact?: string;
	voiceIds?: string[];
	sectionIds?: string[];
}

export const POST: RequestHandler = async ({ request, platform, cookies, locals }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const orgId = locals.org.id;

	// Authenticate and authorize
	const currentUser = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentUser);

	// Parse and validate request body
	const body = (await request.json()) as CreateRosterMemberRequest;

	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const name = body.name.trim();

	// Validate email format if provided
	if (body.emailContact && typeof body.emailContact === 'string') {
		const emailContact = body.emailContact.trim();
		if (emailContact.length > 0) {
			// Basic email validation
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(emailContact)) {
				return json({ error: 'Invalid email format' }, { status: 400 });
			}
		}
	}

	// Check name uniqueness within the organization (case-insensitive)
	const existingMember = await db
		.prepare(
			`SELECT m.id FROM members m
			 JOIN member_organizations mo ON m.id = mo.member_id
			 WHERE LOWER(m.name) = LOWER(?) AND mo.org_id = ?`
		)
		.bind(name, orgId)
		.first();
	if (existingMember) {
		return json({ error: `Member with name "${name}" already exists` }, { status: 409 });
	}

	// Create roster member
	try {
		const newMember = await createRosterMember(db, {
			name,
			email_contact: body.emailContact?.trim() || undefined,
			voiceIds: body.voiceIds,
			sectionIds: body.sectionIds,
			addedBy: currentUser.id,
			orgId
		});

		return json({
			id: newMember.id,
			name: newMember.name,
			emailContact: newMember.email_contact,
			voices: newMember.voices,
			sections: newMember.sections,
			joinedAt: newMember.joined_at
		}, { status: 201 });
	} catch (err) {
		console.error('Failed to create roster member:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to create roster member' },
			{ status: 500 }
		);
	}
};
