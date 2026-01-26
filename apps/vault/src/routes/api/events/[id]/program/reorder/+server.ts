// Reorder program API endpoint
// POST /api/events/[id]/program/reorder

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents } from '$lib/server/auth/permissions';
import { reorderProgram } from '$lib/server/db/programs';

/**
 * POST /api/events/[id]/program/reorder
 * Reorders scores in the event program
 * Requires: Conductor/admin role
 * Body: { score_ids: string[] } - Array of score IDs in desired order
 */
export async function POST(event: RequestEvent) {
	const { platform, cookies, params, request } = event;
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require manage events permission
	const member = await getAuthenticatedMember(db, cookies);
	if (!canManageEvents(member)) {
		throw error(403, 'Only conductors and admins can manage programs');
	}

	const eventId = params.id;
	if (!eventId) {
		throw error(400, 'Event ID required');
	}

	const body = await request.json() as any;
	const { score_ids } = body;

	if (!Array.isArray(score_ids) || score_ids.length === 0) {
		throw error(400, 'Missing required field: score_ids (array)');
	}

	await reorderProgram(db, eventId, score_ids);

	return json({ success: true });
}
