import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById } from '$lib/server/db/members';
import { canManageEvents, canUploadScores } from '$lib/server/auth/permissions';
import type { Season } from '$lib/server/db/seasons';
import type { Event } from '$lib/server/db/events';
import type { SeasonRepertoire, Work } from '$lib/types';

interface SeasonWithEvents extends Season {
	events: Event[];
}

export const load: PageServerLoad = async ({ params, fetch, platform, cookies }) => {
	const seasonId = params.id;
	if (!seasonId) {
		throw error(400, 'Season ID is required');
	}

	// Fetch season with events
	const [seasonResponse, repertoireResponse, worksResponse] = await Promise.all([
		fetch(`/api/seasons/${seasonId}?events=true`),
		fetch(`/api/seasons/${seasonId}/works`),
		fetch(`/api/works`)
	]);
	
	if (!seasonResponse.ok) {
		if (seasonResponse.status === 404) {
			throw error(404, 'Season not found');
		}
		throw error(seasonResponse.status, 'Failed to load season');
	}

	const season = (await seasonResponse.json()) as SeasonWithEvents;
	const repertoire = repertoireResponse.ok 
		? (await repertoireResponse.json()) as SeasonRepertoire 
		: { seasonId, works: [] };
	const allWorks = worksResponse.ok 
		? (await worksResponse.json()) as Work[] 
		: [];

	// Get current user's permissions
	let canManage = false;
	let canManageLibrary = false;

	const db = platform?.env?.DB;
	const memberId = cookies.get('member_id');

	if (db && memberId) {
		const member = await getMemberById(db, memberId);
		if (member) {
			canManage = canManageEvents(member);
			canManageLibrary = canUploadScores(member);
		}
	}

	// Filter out works already in repertoire for the add dropdown
	const repertoireWorkIds = new Set(repertoire.works.map(w => w.work.id));
	const availableWorks = allWorks.filter(w => !repertoireWorkIds.has(w.id));

	return {
		season,
		events: season.events ?? [],
		repertoire,
		availableWorks,
		canManage,
		canManageLibrary
	};
};
