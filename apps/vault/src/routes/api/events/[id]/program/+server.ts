// Program management API endpoints
// POST /api/events/[id]/program - Add score to program
// GET /api/events/[id]/program - Get program (for reference)

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents } from '$lib/server/auth/permissions';
import { addToProgram, getEventProgram } from '$lib/server/db/programs';

/**
 * GET /api/events/[id]/program
 * Returns the event program (setlist)
 */
export async function GET(event: RequestEvent) {
	const { platform, cookies, params } = event;
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require authentication
	await getAuthenticatedMember(db, cookies);

	const eventId = params.id;
	if (!eventId) {
		throw error(400, 'Event ID required');
	}

	const program = await getEventProgram(db, eventId);
	return json(program);
}

/**
 * POST /api/events/[id]/program
 * Adds a score to the event program
 * Requires: Conductor/admin role
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
	const { score_id, position, notes } = body;

	if (!score_id || typeof position !== 'number') {
		throw error(400, 'Missing required fields: score_id, position');
	}

	await addToProgram(db, eventId, score_id, position, notes);

	// Return updated program
	const program = await getEventProgram(db, eventId);
	return json(program);
}
