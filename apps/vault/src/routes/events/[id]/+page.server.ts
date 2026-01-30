// Server-side loader for event detail page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents, canRecordAttendance, canUploadScores } from '$lib/server/auth/permissions';
import { getEventById } from '$lib/server/db/events';
import { getEventProgram } from '$lib/server/db/programs';
import { getAllEditions, getEditionsByWorkId } from '$lib/server/db/editions';
import { getParticipation } from '$lib/server/db/participation';
import { getEventRepertoire } from '$lib/server/db/event-repertoire';
import { getEventMaterialsForMember } from '$lib/server/db/event-materials';
import { getAllWorks } from '$lib/server/db/works';
import type { Edition } from '$lib/types';

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

	// Load event program (legacy editions on setlist)
	const program = await getEventProgram(db, eventId);

	// Load available editions (for adding to program - legacy)
	const allEditions = await getAllEditions(db);

	// Check if user can manage this event
	const canManage = canManageEvents(member);
	const canManageLibrary = canUploadScores(member);

	// Get current member's participation status
	const myParticipation = await getParticipation(db, member.id, eventId);

	// Check if event has started (for RSVP lock and attendance visibility)
	const now = new Date();
	const eventStart = new Date(event.starts_at);
	const hasStarted = now >= eventStart;

	// Check if member can record attendance
	const canRecordAttendanceFlag = canRecordAttendance(member);

	// ============================================================================
	// EVENT REPERTOIRE (Issue #121)
	// ============================================================================
	
	// Load event repertoire (works + editions)
	const repertoire = await getEventRepertoire(db, eventId);
	
	// Load all works for adding to repertoire
	const allWorks = await getAllWorks(db);
	
	// Works already in event repertoire
	const eventWorkIds = new Set(repertoire.works.map(w => w.work.id));
	
	// Note: Season integration is a future feature. For now, events don't have season_id.
	// When that's added, we'll load season repertoire for suggestions.
	const seasonWorkIds: string[] = [];
	
	// Available works: not already in event, sorted alphabetically
	const availableWorks = allWorks
		.filter(w => !eventWorkIds.has(w.id))
		.sort((a, b) => a.title.localeCompare(b.title));
	
	// Build map of work -> editions for repertoire management
	const workEditionsMap: Record<string, Edition[]> = {};
	for (const repWork of repertoire.works) {
		workEditionsMap[repWork.work.id] = await getEditionsByWorkId(db, repWork.work.id);
	}
	// Also load editions for available works (for when adding)
	for (const work of availableWorks.slice(0, 20)) { // Limit to first 20 for performance
		if (!workEditionsMap[work.id]) {
			workEditionsMap[work.id] = await getEditionsByWorkId(db, work.id);
		}
	}

	// ============================================================================
	// WHAT TO BRING (Issue #122)
	// ============================================================================
	
	// Load personalized materials for the current member
	const myMaterials = await getEventMaterialsForMember(db, eventId, member.id);

	return {
		event,
		program,
		allEditions,
		canManage,
		canManageLibrary,
		myParticipation,
		hasStarted,
		canRecordAttendance: canRecordAttendanceFlag,
		currentMemberId: member.id,
		// Event repertoire (Issue #121)
		repertoire,
		availableWorks,
		seasonWorkIds,
		workEditionsMap,
		// What to bring (Issue #122)
		myMaterials
	};
};
