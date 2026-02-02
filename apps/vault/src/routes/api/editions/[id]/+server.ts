// API endpoint for individual edition operations
// GET /api/editions/[id] - Get edition by ID
// PATCH /api/editions/[id] - Update edition
// DELETE /api/editions/[id] - Delete edition
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getEditionById, updateEdition, deleteEdition } from '$lib/server/db/editions';
import type { UpdateEditionInput, EditionType } from '$lib/types';
import { LICENSE_TYPES } from '$lib/types';

const VALID_EDITION_TYPES: EditionType[] = ['full_score', 'vocal_score', 'part', 'reduction', 'audio', 'video', 'supplementary'];

function validateUpdateInput(body: Partial<UpdateEditionInput>): string | null {
	if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) return 'Name cannot be empty';
	if (body.editionType !== undefined && !VALID_EDITION_TYPES.includes(body.editionType)) return 'Invalid edition type';
	if (body.licenseType !== undefined && !LICENSE_TYPES.includes(body.licenseType)) return 'Invalid license type';
	if (body.sectionIds !== undefined && !Array.isArray(body.sectionIds)) return 'sectionIds must be an array';
	return null;
}

function trimOrNull(value: unknown): string | null {
	if (value === null) return null;
	return typeof value === 'string' ? value.trim() || null : null;
}

function buildUpdateInput(body: Partial<UpdateEditionInput>): UpdateEditionInput {
	const input: UpdateEditionInput = {};
	if (body.name !== undefined) input.name = body.name.trim();
	if (body.arranger !== undefined) input.arranger = trimOrNull(body.arranger);
	if (body.publisher !== undefined) input.publisher = trimOrNull(body.publisher);
	if (body.voicing !== undefined) input.voicing = trimOrNull(body.voicing);
	if (body.editionType !== undefined) input.editionType = body.editionType;
	if (body.licenseType !== undefined) input.licenseType = body.licenseType;
	if (body.notes !== undefined) input.notes = trimOrNull(body.notes);
	if (body.externalUrl !== undefined) input.externalUrl = trimOrNull(body.externalUrl);
	if (body.sectionIds !== undefined) input.sectionIds = body.sectionIds;
	return input;
}

export async function GET({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: any authenticated member can view editions
	await getAuthenticatedMember(db, cookies);

	const editionId = params.id;
	if (!editionId) {
		throw error(400, 'Edition ID is required');
	}

	const edition = await getEditionById(db, editionId);
	if (!edition) {
		throw error(404, 'Edition not found');
	}

	return json(edition);
}

export async function PATCH({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const editionId = params.id;
	if (!editionId) throw error(400, 'Edition ID is required');

	const body = (await request.json()) as Partial<UpdateEditionInput>;
	const validationError = validateUpdateInput(body);
	if (validationError) return json({ error: validationError }, { status: 400 });

	const edition = await updateEdition(db, editionId, buildUpdateInput(body));
	if (!edition) throw error(404, 'Edition not found');

	return json(edition);
}

export async function DELETE({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require librarian role
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const editionId = params.id;
	if (!editionId) {
		throw error(400, 'Edition ID is required');
	}

	const deleted = await deleteEdition(db, editionId);
	if (!deleted) {
		throw error(404, 'Edition not found');
	}

	return json({ success: true });
}
