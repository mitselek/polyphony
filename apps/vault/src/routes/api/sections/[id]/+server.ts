// API endpoint for managing individual sections
// PATCH /api/sections/[id] - Toggle section active status
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { toggleSectionActive, getSectionById } from '$lib/server/db/sections';

export async function PATCH({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require admin
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	const sectionId = params.id;
	if (!sectionId) {
		throw error(400, 'Section ID is required');
	}

	// Parse request body
	const body = (await request.json()) as { isActive?: boolean };

	if (typeof body.isActive !== 'boolean') {
		return json({ error: 'isActive must be a boolean' }, { status: 400 });
	}

	// Toggle the section
	const updated = await toggleSectionActive(db, sectionId, body.isActive);

	if (!updated) {
		throw error(404, 'Section not found');
	}

	// Return updated section
	const section = await getSectionById(db, sectionId);
	return json(section);
}
