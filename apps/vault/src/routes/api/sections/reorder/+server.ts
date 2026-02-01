// API endpoint for reordering sections
// POST /api/sections/reorder - Update display order
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { reorderSections, getAllSectionsWithCounts } from '$lib/server/db/sections';

/** Validate request body for section reordering */
function validateReorderRequest(body: { orgId?: string; sectionIds?: string[] }): string | null {
	if (!body.orgId || typeof body.orgId !== 'string') {
		return 'orgId is required';
	}
	if (!Array.isArray(body.sectionIds) || body.sectionIds.length === 0) {
		return 'sectionIds must be a non-empty array';
	}
	if (!body.sectionIds.every((id) => typeof id === 'string')) {
		return 'All section IDs must be strings';
	}
	return null;
}

export async function POST({ request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	const body = (await request.json()) as { orgId?: string; sectionIds?: string[] };
	const validationError = validateReorderRequest(body);
	if (validationError) return json({ error: validationError }, { status: 400 });

	try {
		await reorderSections(db, body.sectionIds!);
		const sections = await getAllSectionsWithCounts(db, body.orgId!);
		return json(sections);
	} catch (err) {
		console.error('Failed to reorder sections:', err);
		return json({ error: err instanceof Error ? err.message : 'Failed to reorder sections' }, { status: 500 });
	}
}
