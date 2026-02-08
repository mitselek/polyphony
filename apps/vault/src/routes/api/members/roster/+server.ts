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

function validateEmail(emailContact?: string): string | null {
	if (!emailContact || typeof emailContact !== 'string') return null;
	const trimmed = emailContact.trim();
	if (trimmed.length === 0) return null;
	
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmed)) {
		return 'Invalid email format';
	}
	return null;
}

async function checkNameUniqueness(db: D1Database, name: string, orgId: string): Promise<boolean> {
	const existingMember = await db
		.prepare(
			`SELECT m.id FROM members m
			 JOIN member_organizations mo ON m.id = mo.member_id
			 WHERE LOWER(m.name) = LOWER(?) AND mo.org_id = ?`
		)
		.bind(name, orgId)
		.first();
	return !existingMember;
}

async function createRosterMemberWithValidation(
	db: D1Database,
	body: CreateRosterMemberRequest,
	orgId: string,
	currentUserId: string
) {
	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return { error: 'Name is required', status: 400 };
	}

	const name = body.name.trim();
	
	const emailError = validateEmail(body.emailContact);
	if (emailError) {
		return { error: emailError, status: 400 };
	}

	const isUnique = await checkNameUniqueness(db, name, orgId);
	if (!isUnique) {
		return { error: `Member with name "${name}" already exists`, status: 409 };
	}

	const newMember = await createRosterMember(db, {
		name,
		email_contact: body.emailContact?.trim() || undefined,
		voiceIds: body.voiceIds,
		sectionIds: body.sectionIds,
		addedBy: currentUserId,
		orgId
	});

	return { member: newMember, status: 201 };
}

export const POST: RequestHandler = async ({ request, platform, cookies, locals }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const orgId = locals.org.id;
	const currentUser = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentUser);

	const body = (await request.json()) as CreateRosterMemberRequest;

	try {
		const result = await createRosterMemberWithValidation(db, body, orgId, currentUser.id);
		
		if ('error' in result) {
			return json({ error: result.error }, { status: result.status });
		}

		return json({
			id: result.member.id,
			name: result.member.name,
			emailContact: result.member.email_contact,
			voices: result.member.voices,
			sections: result.member.sections,
			joinedAt: result.member.joined_at
		}, { status: 201 });
	} catch (err) {
		console.error('Failed to create roster member:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to create roster member' },
			{ status: 500 }
		);
	}
};
