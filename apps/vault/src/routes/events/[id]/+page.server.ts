// Server-side loader for event detail page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents } from '$lib/server/auth/permissions';
import { getEventById } from '$lib/server/db/events';
import { getEventProgram } from '$lib/server/db/programs';
import { listScores } from '$lib/server/db/scores';

export const load: PageServerLoad = async ({ platform, cookies, params }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require authentication
	const member = await getAuthenticatedMember(db, cookies);

	const eventId = params.id;
	if (!eventId) {
		throw error(400, 'Event ID required');
	}

	// Load event details
	const event = await getEventById(db, eventId);
	if (!event) {
		throw error(404, 'Event not found');
	}

	// Load event program (scores on setlist)
	const program = await getEventProgram(db, eventId);

	// Load available scores (for adding to program)
	const allScores = await listScores(db);

	// Check if user can manage this event
	const canManage = canManageEvents(member);

	return {
		event,
		program,
		allScores,
		canManage
	};
};
