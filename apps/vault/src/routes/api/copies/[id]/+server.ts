// API endpoint for individual physical copy operations
// GET /api/copies/[id] - Get copy by ID
// PATCH /api/copies/[id] - Update copy
// DELETE /api/copies/[id] - Delete copy
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import {
	getPhysicalCopyById,
	updatePhysicalCopy,
	deletePhysicalCopy
} from '$lib/server/db/physical-copies';
import type { CopyCondition } from '$lib/types';

const VALID_CONDITIONS: CopyCondition[] = ['good', 'fair', 'poor', 'lost'];

interface UpdateInput {
	condition?: CopyCondition;
	notes?: string | null;
	acquiredAt?: string | null;
}

function validateUpdateInput(body: UpdateInput): string | null {
	if (body.condition !== undefined && !VALID_CONDITIONS.includes(body.condition)) {
		return `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}`;
	}
	if (body.acquiredAt !== undefined && body.acquiredAt !== null) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(body.acquiredAt)) {
			return 'Acquired date must be in YYYY-MM-DD format';
		}
	}
	return null;
}

export async function GET({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	// Auth: any authenticated member can view
	await getAuthenticatedMember(db, cookies);

	const copyId = params.id;
	if (!copyId) throw error(400, 'Copy ID is required');

	const copy = await getPhysicalCopyById(db, copyId);
	if (!copy) throw error(404, 'Copy not found');

	return json(copy);
}

export async function PATCH({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	// Auth: librarian role required
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const copyId = params.id;
	if (!copyId) throw error(400, 'Copy ID is required');

	// Verify copy exists
	const existing = await getPhysicalCopyById(db, copyId);
	if (!existing) throw error(404, 'Copy not found');

	const body = (await request.json()) as UpdateInput;
	const validationError = validateUpdateInput(body);
	if (validationError) {
		return json({ error: validationError }, { status: 400 });
	}

	const copy = await updatePhysicalCopy(db, copyId, {
		condition: body.condition,
		notes: body.notes,
		acquiredAt: body.acquiredAt
	});

	return json(copy);
}

export async function DELETE({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	// Auth: librarian role required
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const copyId = params.id;
	if (!copyId) throw error(400, 'Copy ID is required');

	const deleted = await deletePhysicalCopy(db, copyId);
	if (!deleted) throw error(404, 'Copy not found');

	return json({ success: true });
}
