// Remove edition from program API endpoint
// DELETE /api/events/[id]/program/[edition_id]

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents } from '$lib/server/auth/permissions';
import { removeFromProgram } from '$lib/server/db/programs';

/**
 * DELETE /api/events/[id]/program/[edition_id]
 * Removes an edition from the event program
 * Requires: Conductor/admin role
 */
export async function DELETE(event: RequestEvent) {
	const { platform, cookies, params } = event;
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require manage events permission
	const member = await getAuthenticatedMember(db, cookies);
	if (!canManageEvents(member)) {
		throw error(403, 'Only conductors and admins can manage programs');
	}

	const eventId = params.id;
	const editionId = params.edition_id;
	
	if (!eventId || !editionId) {
		throw error(400, 'Event ID and Edition ID required');
	}

	const success = await removeFromProgram(db, eventId, editionId);
	
	if (!success) {
		throw error(404, 'Edition not found in program');
	}

	return json({ success: true });
}
