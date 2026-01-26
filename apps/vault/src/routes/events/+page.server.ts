// Server-side loader for events list page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getUpcomingEvents } from '$lib/server/db/events';
import { canCreateEvents } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require authentication
	const member = await getAuthenticatedMember(db, cookies);

	// Load upcoming events
	const events = await getUpcomingEvents(db);

	// Check if user can create events
	const canCreate = canCreateEvents(member);

	return {
		events,
		canCreate
	};
};
