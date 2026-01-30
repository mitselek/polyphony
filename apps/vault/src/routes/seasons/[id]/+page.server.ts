import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById } from '$lib/server/db/members';
import { canManageEvents } from '$lib/server/auth/permissions';
import type { Season } from '$lib/server/db/seasons';
import type { Event } from '$lib/server/db/events';

interface SeasonWithEvents extends Season {
	events: Event[];
}

export const load: PageServerLoad = async ({ params, fetch, platform, cookies }) => {
	const seasonId = params.id;
	if (!seasonId) {
		throw error(400, 'Season ID is required');
	}

	// Fetch season with events
	const response = await fetch(`/api/seasons/${seasonId}?events=true`);
	
	if (!response.ok) {
		if (response.status === 404) {
			throw error(404, 'Season not found');
		}
		throw error(response.status, 'Failed to load season');
	}

	const season = (await response.json()) as SeasonWithEvents;

	// Get current user's permissions
	let canManage = false;

	const db = platform?.env?.DB;
	const memberId = cookies.get('member_id');

	if (db && memberId) {
		const member = await getMemberById(db, memberId);
		if (member) {
			canManage = canManageEvents(member);
		}
	}

	return {
		season,
		events: season.events ?? [],
		canManage
	};
};
