// API endpoint for editions collection under a work
// GET /api/works/[id]/editions - List all editions for a work
// POST /api/works/[id]/editions - Create a new edition
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getWorkById } from '$lib/server/db/works';
import { createEdition, getEditionsByWorkId } from '$lib/server/db/editions';
import type { CreateEditionInput, EditionType, LicenseType } from '$lib/types';

const VALID_EDITION_TYPES: EditionType[] = [
	'full_score',
	'vocal_score',
	'part',
	'reduction',
	'audio',
	'video',
	'supplementary'
];

const VALID_LICENSE_TYPES: LicenseType[] = ['public_domain', 'licensed', 'owned'];

export async function GET({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: any authenticated member can view editions
	await getAuthenticatedMember(db, cookies);

	const workId = params.id;
	if (!workId) {
		throw error(400, 'Work ID is required');
	}

	// Verify work exists
	const work = await getWorkById(db, workId);
	if (!work) {
		throw error(404, 'Work not found');
	}

	const editions = await getEditionsByWorkId(db, workId);
	return json(editions);
}

export async function POST({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require librarian role
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const workId = params.id;
	if (!workId) {
		throw error(400, 'Work ID is required');
	}

	// Verify work exists
	const work = await getWorkById(db, workId);
	if (!work) {
		throw error(404, 'Work not found');
	}

	// Parse request body
	const body = (await request.json()) as Partial<CreateEditionInput>;

	// Validate required fields
	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	// Validate edition type if provided
	if (body.editionType && !VALID_EDITION_TYPES.includes(body.editionType)) {
		return json({ error: 'Invalid edition type' }, { status: 400 });
	}

	// Validate license type if provided
	if (body.licenseType && !VALID_LICENSE_TYPES.includes(body.licenseType)) {
		return json({ error: 'Invalid license type' }, { status: 400 });
	}

	// Validate sectionIds if provided
	if (body.sectionIds !== undefined && !Array.isArray(body.sectionIds)) {
		return json({ error: 'sectionIds must be an array' }, { status: 400 });
	}

	// Build input
	const input: CreateEditionInput = {
		workId,
		name: body.name.trim(),
		arranger: typeof body.arranger === 'string' ? body.arranger.trim() || undefined : undefined,
		publisher: typeof body.publisher === 'string' ? body.publisher.trim() || undefined : undefined,
		voicing: typeof body.voicing === 'string' ? body.voicing.trim() || undefined : undefined,
		editionType: body.editionType,
		licenseType: body.licenseType,
		notes: typeof body.notes === 'string' ? body.notes.trim() || undefined : undefined,
		externalUrl:
			typeof body.externalUrl === 'string' ? body.externalUrl.trim() || undefined : undefined,
		sectionIds: body.sectionIds
	};

	const edition = await createEdition(db, input);
	return json(edition, { status: 201 });
}
