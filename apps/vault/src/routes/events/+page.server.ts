// Server-side loader for events list page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getUpcomingEvents } from '$lib/server/db/events';
import { canCreateEvents } from '$lib/server/auth/permissions';
import { getParticipation } from '$lib/server/db/participation';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require authentication
	const member = await getAuthenticatedMember(db, cookies);

	// Load upcoming events
	const events = await getUpcomingEvents(db);

	// Load participation status for each event
	const eventsWithParticipation = await Promise.all(
		events.map(async (event) => {
			const participation = await getParticipation(db, member.id, event.id);
			const now = new Date();
			const eventStart = new Date(event.starts_at);
			const hasStarted = now >= eventStart;
			
			return {
				...event,
				myRsvp: participation?.plannedStatus ?? null,
				rsvpLocked: hasStarted
			};
		})
	);

	// Check if user can create events
	const canCreate = canCreateEvents(member);

	return {
		events: eventsWithParticipation,
		canCreate,
		currentMemberId: member.id
	};
};
