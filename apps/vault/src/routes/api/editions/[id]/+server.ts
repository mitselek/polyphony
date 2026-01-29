// API endpoint for individual edition operations
// GET /api/editions/[id] - Get edition by ID
// PATCH /api/editions/[id] - Update edition
// DELETE /api/editions/[id] - Delete edition
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getEditionById, updateEdition, deleteEdition } from '$lib/server/db/editions';
import type { UpdateEditionInput, EditionType, LicenseType } from '$lib/types';

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

	// Parse request body
	const body = (await request.json()) as Partial<UpdateEditionInput>;

	// Validate name if provided
	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || body.name.trim().length === 0) {
			return json({ error: 'Name cannot be empty' }, { status: 400 });
		}
	}

	// Validate edition type if provided
	if (body.editionType !== undefined && !VALID_EDITION_TYPES.includes(body.editionType)) {
		return json({ error: 'Invalid edition type' }, { status: 400 });
	}

	// Validate license type if provided
	if (body.licenseType !== undefined && !VALID_LICENSE_TYPES.includes(body.licenseType)) {
		return json({ error: 'Invalid license type' }, { status: 400 });
	}

	// Validate sectionIds if provided
	if (body.sectionIds !== undefined && !Array.isArray(body.sectionIds)) {
		return json({ error: 'sectionIds must be an array' }, { status: 400 });
	}

	// Build update input
	const input: UpdateEditionInput = {};

	if (body.name !== undefined) {
		input.name = body.name.trim();
	}
	if (body.arranger !== undefined) {
		input.arranger = body.arranger === null ? null : (body.arranger?.trim() || null);
	}
	if (body.publisher !== undefined) {
		input.publisher = body.publisher === null ? null : (body.publisher?.trim() || null);
	}
	if (body.voicing !== undefined) {
		input.voicing = body.voicing === null ? null : (body.voicing?.trim() || null);
	}
	if (body.editionType !== undefined) {
		input.editionType = body.editionType;
	}
	if (body.licenseType !== undefined) {
		input.licenseType = body.licenseType;
	}
	if (body.notes !== undefined) {
		input.notes = body.notes === null ? null : (body.notes?.trim() || null);
	}
	if (body.externalUrl !== undefined) {
		input.externalUrl = body.externalUrl === null ? null : (body.externalUrl?.trim() || null);
	}
	if (body.sectionIds !== undefined) {
		input.sectionIds = body.sectionIds;
	}

	const edition = await updateEdition(db, editionId, input);
	if (!edition) {
		throw error(404, 'Edition not found');
	}

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
