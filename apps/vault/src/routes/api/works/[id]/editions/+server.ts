// API endpoint for editions collection under a work
// GET /api/works/[id]/editions - List all editions for a work
// POST /api/works/[id]/editions - Create a new edition
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getWorkById } from '$lib/server/db/works';
import { createEdition, getEditionsByWorkId } from '$lib/server/db/editions';
import type { CreateEditionInput, EditionType } from '$lib/types';
import { LICENSE_TYPES } from '$lib/types';

const VALID_EDITION_TYPES: EditionType[] = ['full_score', 'vocal_score', 'part', 'reduction', 'audio', 'video', 'supplementary'];

// Helper: Validation error response
function validationError(message: string) {
	return json({ error: message }, { status: 400 });
}

// Helper: Database error response
function dbError(message = 'Database not available') {
	return error(500, message);
}

// Helper: Not found error response
function notFound(resource = 'Work') {
	return error(404, `${resource} not found`);
}

function validateCreateInput(body: Partial<CreateEditionInput>): string | null {
	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) return 'Name is required';
	if (body.editionType && !VALID_EDITION_TYPES.includes(body.editionType)) return 'Invalid edition type';
	if (body.licenseType && !LICENSE_TYPES.includes(body.licenseType)) return 'Invalid license type';
	if (body.sectionIds !== undefined && !Array.isArray(body.sectionIds)) return 'sectionIds must be an array';
	return null;
}

function trimOrUndefined(value: unknown): string | undefined {
	return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function buildCreateInput(workId: string, body: Partial<CreateEditionInput>): CreateEditionInput {
	return {
		workId, name: body.name!.trim(), arranger: trimOrUndefined(body.arranger),
		publisher: trimOrUndefined(body.publisher), voicing: trimOrUndefined(body.voicing),
		editionType: body.editionType, licenseType: body.licenseType,
		notes: trimOrUndefined(body.notes), externalUrl: trimOrUndefined(body.externalUrl),
		sectionIds: body.sectionIds
	};
}

export async function GET({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw dbError();

	await getAuthenticatedMember(db, cookies);

	const workId = params.id;
	if (!workId) throw error(400, 'Work ID is required');

	const work = await getWorkById(db, workId);
	if (!work) throw notFound();

	const editions = await getEditionsByWorkId(db, workId);
	return json(editions);
}

export async function POST({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw dbError();

	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const workId = params.id;
	if (!workId) throw error(400, 'Work ID is required');

	const work = await getWorkById(db, workId);
	if (!work) throw notFound();

	const body = (await request.json()) as Partial<CreateEditionInput>;
	const validationErr = validateCreateInput(body);
	if (validationErr) return validationError(validationErr);

	const edition = await createEdition(db, buildCreateInput(workId, body));
	return json(edition, { status: 201 });
}
