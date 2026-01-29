// API endpoint for editions collection under a work
// GET /api/works/[id]/editions - List all editions for a work
// POST /api/works/[id]/editions - Create a new edition
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getWorkById } from '$lib/server/db/works';
import { createEdition, getEditionsByWorkId } from '$lib/server/db/editions';
import type { CreateEditionInput, EditionType, LicenseType } from '$lib/types';

const VALID_EDITION_TYPES: EditionType[] = ['full_score', 'vocal_score', 'part', 'reduction', 'audio', 'video', 'supplementary'];
const VALID_LICENSE_TYPES: LicenseType[] = ['public_domain', 'licensed', 'owned'];

function validateCreateInput(body: Partial<CreateEditionInput>): string | null {
	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) return 'Name is required';
	if (body.editionType && !VALID_EDITION_TYPES.includes(body.editionType)) return 'Invalid edition type';
	if (body.licenseType && !VALID_LICENSE_TYPES.includes(body.licenseType)) return 'Invalid license type';
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
	if (!db) throw error(500, 'Database not available');

	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const workId = params.id;
	if (!workId) throw error(400, 'Work ID is required');

	const work = await getWorkById(db, workId);
	if (!work) throw error(404, 'Work not found');

	const body = (await request.json()) as Partial<CreateEditionInput>;
	const validationError = validateCreateInput(body);
	if (validationError) return json({ error: validationError }, { status: 400 });

	const edition = await createEdition(db, buildCreateInput(workId, body));
	return json(edition, { status: 201 });
}
