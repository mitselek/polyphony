// Roster view database operations
import type {
	RosterView,
	RosterEvent,
	RosterMember,
	ParticipationStatus,
	RosterSummary,
	RosterViewFilters,
	EventType,
	PlannedStatus,
	ActualStatus,
	Section,
	Voice
} from '$lib/types';
import { queryMemberSections } from './queries/members';

/**
 * Build events query with optional date filtering
 */
function buildEventsQuery(filters?: RosterViewFilters): { sql: string; params: string[] } {
	let sql = 'SELECT id, title as name, starts_at as date, event_type as type FROM events';
	const params: string[] = [];

	if (filters?.start && filters?.end) {
		sql += ' WHERE starts_at >= ? AND starts_at <= ?';
		params.push(filters.start, filters.end);
	} else if (filters?.start) {
		sql += ' WHERE starts_at >= ?';
		params.push(filters.start);
	} else if (filters?.end) {
		sql += ' WHERE starts_at <= ?';
		params.push(filters.end);
	}

	sql += ' ORDER BY starts_at ASC';

	return { sql, params };
}

/**
 * Build members query with optional section filtering
 * Sorts by primary section display order, then by member name
 * Includes primary section details for statistics
 */
function buildMembersQuery(filters?: RosterViewFilters): { sql: string; params: string[] } {
	let sql = `SELECT DISTINCT m.*, 
	       ms.section_id as primary_section, 
	       s.name as section_name, 
	       s.abbreviation as section_abbr,
	       s.is_active as section_is_active
	FROM members m
	LEFT JOIN member_sections ms ON m.id = ms.member_id AND ms.is_primary = 1
	LEFT JOIN sections s ON ms.section_id = s.id`;
	const params: string[] = [];

	if (filters?.sectionId) {
		sql += ' WHERE ms.section_id = ?';
		params.push(filters.sectionId);
	}

	sql += ' ORDER BY s.display_order ASC, m.name ASC, m.email_id ASC';

	return { sql, params };
}

/**
 * Calculate attendance summary statistics including section breakdown
 */
function calculateAttendanceSummary(
	events: any[],
	members: any[],
	participation: any[]
): RosterSummary {
	const totalEvents = events.length;
	const totalMembers = members.length;

	// Calculate average attendance (only for events with recorded attendance)
	let totalPresent = 0;
	let totalPossible = 0;

	participation.forEach((p) => {
		if (p.actual_status !== null) {
			totalPossible++;
			if (p.actual_status === 'present') {
				totalPresent++;
			}
		}
	});

	const averageAttendance =
		totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

	// Calculate section-based statistics (Epic #73)
	const sectionStats: Record<string, any> = {};

	members.forEach((member) => {
		// Only include members with active primary sections
		if (!member.primary_section || !member.section_is_active) {
			return;
		}

		const sectionId = member.primary_section;
		const sectionName = member.section_name;
		const sectionAbbr = member.section_abbr;

		// Initialize section stats if not exists
		if (!sectionStats[sectionId]) {
			sectionStats[sectionId] = {
				sectionName,
				sectionAbbr,
				total: 0,
				yes: 0,
				no: 0,
				maybe: 0,
				late: 0,
				responded: 0
			};
		}

		sectionStats[sectionId].total++;

		// Count RSVPs for this member across all events
		const memberParticipation = participation.filter((p) => p.member_id === member.id);
		memberParticipation.forEach((p) => {
			if (p.planned_status === 'yes') {
				sectionStats[sectionId].yes++;
			} else if (p.planned_status === 'no') {
				sectionStats[sectionId].no++;
			} else if (p.planned_status === 'maybe') {
				sectionStats[sectionId].maybe++;
			} else if (p.planned_status === 'late') {
				sectionStats[sectionId].late++;
			}

			if (p.planned_status !== null) {
				sectionStats[sectionId].responded++;
			}
		});
	});

	return {
		totalEvents,
		totalMembers,
		averageAttendance,
		sectionStats
	};
}

/**
 * Get comprehensive roster view with events, members, and participation
 * @param db - D1 Database instance
 * @param filters - Optional filters for date range and section
 * @returns Complete roster view with events, members, and summary statistics
 */
export async function getRosterView(
	db: D1Database,
	filters?: RosterViewFilters
): Promise<RosterView> {
	// Fetch events with date filtering
	const eventsQuery = buildEventsQuery(filters);
	const eventsResult = await db
		.prepare(eventsQuery.sql)
		.bind(...eventsQuery.params)
		.all<{
			id: string;
			name: string;
			date: string;
			type: string;
		}>();

	const events = eventsResult.results;

	// Fetch members with optional section filtering
	const membersQuery = buildMembersQuery(filters);
	const membersResult = await db
		.prepare(membersQuery.sql)
		.bind(...membersQuery.params)
		.all<{
			id: string;
			email_id: string | null;
			name: string;
			nickname: string | null;
		}>();

	const members = membersResult.results;

	// Fetch all participation records
	const participationResult = await db
		.prepare('SELECT * FROM participation')
		.all<{
			id: string;
			member_id: string;
			event_id: string;
			planned_status: PlannedStatus | null;
			actual_status: ActualStatus | null;
			recorded_at: string | null;
		}>();

	const participation = participationResult.results;

	// Build RosterEvent objects with participation maps
	const rosterEvents: RosterEvent[] = events.map((event) => {
		const participationMap = new Map<string, ParticipationStatus>();

		// Find all participation records for this event
		participation
			.filter((p) => p.event_id === event.id)
			.forEach((p) => {
				participationMap.set(p.member_id, {
					plannedStatus: p.planned_status,
					actualStatus: p.actual_status,
					recordedAt: p.recorded_at
				});
			});

		return {
			id: event.id,
			name: event.name,
			date: event.date,
			type: event.type as EventType,
			participation: participationMap
		};
	});

	// Build RosterMember objects with sections and voices
	const rosterMembers: RosterMember[] = await Promise.all(
		members.map(async (member) => {
			const memberSections = await queryMemberSections(db, member.id);
			const primarySection = memberSections.length > 0 ? memberSections[0] : null;

			return {
				id: member.id,
				name: member.name,
				nickname: member.nickname,
				email: member.email_id,
				primarySection,
				allSections: memberSections,
				primaryVoice: null // Not loaded for roster view
			};
		})
	);

	// Calculate summary statistics
	const summary = calculateAttendanceSummary(events, members, participation);

	return {
		events: rosterEvents,
		members: rosterMembers,
		summary
	};
}
