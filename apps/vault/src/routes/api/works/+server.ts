// API endpoint for works collection operations
// GET /api/works - List all works (with optional search)
// POST /api/works - Create a new work
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { createWork, getAllWorks, searchWorks } from '$lib/server/db/works';
import { DEFAULT_ORG_ID } from '$lib/server/constants';
import type { CreateWorkInput } from '$lib/types';

export async function GET({ url, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: any authenticated member can view works
	await getAuthenticatedMember(db, cookies);

	// TODO: #165 - Get orgId from subdomain routing
	const orgId = DEFAULT_ORG_ID;

	// Check for search query
	const query = url.searchParams.get('q');
	
	if (query && query.trim().length > 0) {
		const works = await searchWorks(db, orgId, query.trim());
		return json(works);
	}

	const works = await getAllWorks(db, orgId);
	return json(works);
}

export async function POST({ request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require librarian role to create works
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	// TODO: #165 - Get orgId from subdomain routing
	const orgId = DEFAULT_ORG_ID;

	// Parse request body
	const body = (await request.json()) as Partial<CreateWorkInput>;

	// Validate required fields
	if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	// Build input
	const input: CreateWorkInput = {
		orgId,
		title: body.title.trim(),
		composer: typeof body.composer === 'string' ? body.composer.trim() || undefined : undefined,
		lyricist: typeof body.lyricist === 'string' ? body.lyricist.trim() || undefined : undefined
	};

	const work = await createWork(db, input);
	return json(work, { status: 201 });
}
