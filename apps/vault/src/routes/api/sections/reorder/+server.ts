// API endpoint for reordering sections
// POST /api/sections/reorder - Update display order
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { reorderSections, getAllSectionsWithCounts } from '$lib/server/db/sections';

export async function POST({ request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require admin
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Parse request body
	const body = (await request.json()) as { sectionIds?: string[] };

	if (!Array.isArray(body.sectionIds) || body.sectionIds.length === 0) {
		return json({ error: 'sectionIds must be a non-empty array' }, { status: 400 });
	}

	// Validate all IDs are strings
	if (!body.sectionIds.every((id) => typeof id === 'string')) {
		return json({ error: 'All section IDs must be strings' }, { status: 400 });
	}

	try {
		await reorderSections(db, body.sectionIds);

		// Return updated sections list
		const sections = await getAllSectionsWithCounts(db);
		return json(sections);
	} catch (err) {
		console.error('Failed to reorder sections:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to reorder sections' },
			{ status: 500 }
		);
	}
}
