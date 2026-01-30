// Server-side loader for event detail page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents, canRecordAttendance } from '$lib/server/auth/permissions';
import { getEventById } from '$lib/server/db/events';
import { getEventProgram } from '$lib/server/db/programs';
import { getAllEditions } from '$lib/server/db/editions';
import { getParticipation } from '$lib/server/db/participation';

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

	// Load event program (editions on setlist)
	const program = await getEventProgram(db, eventId);

	// Load available editions (for adding to program)
	const allEditions = await getAllEditions(db);

	// Check if user can manage this event
	const canManage = canManageEvents(member);

	// Get current member's participation status
	const myParticipation = await getParticipation(db, member.id, eventId);

	// Check if event has started (for RSVP lock and attendance visibility)
	const now = new Date();
	const eventStart = new Date(event.starts_at);
	const hasStarted = now >= eventStart;

	// Check if member can record attendance
	const canRecordAttendanceFlag = canRecordAttendance(member);

	return {
		event,
		program,
		allEditions,
		canManage,
		myParticipation,
		hasStarted,
		canRecordAttendance: canRecordAttendanceFlag,
		currentMemberId: member.id
	};
};
