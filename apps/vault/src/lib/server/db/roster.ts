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

/**
 * Build events query with optional date filtering
 */
function buildEventsQuery(filters?: RosterViewFilters): { sql: string; params: string[] } {
	let sql = 'SELECT * FROM events';
	const params: string[] = [];

	if (filters?.startDate && filters?.endDate) {
		sql += ' WHERE date >= ? AND date <= ?';
		params.push(filters.startDate, filters.endDate);
	} else if (filters?.startDate) {
		sql += ' WHERE date >= ?';
		params.push(filters.startDate);
	} else if (filters?.endDate) {
		sql += ' WHERE date <= ?';
		params.push(filters.endDate);
	}

	sql += ' ORDER BY date DESC';

	return { sql, params };
}

/**
 * Build members query with optional section filtering
 */
function buildMembersQuery(filters?: RosterViewFilters): { sql: string; params: string[] } {
	let sql = 'SELECT DISTINCT m.* FROM members m';
	const params: string[] = [];

	if (filters?.sectionId) {
		sql += ' JOIN member_sections ms ON m.id = ms.member_id WHERE ms.section_id = ?';
		params.push(filters.sectionId);
	}

	sql += ' ORDER BY m.name ASC, m.email ASC';

	return { sql, params };
}

/**
 * Load sections for a member (for roster view)
 */
async function loadMemberSections(db: D1Database, memberId: string): Promise<Section[]> {
	const result = await db
		.prepare(
			`SELECT s.id, s.name, s.abbreviation, s.parent_section_id, s.display_order, s.is_active, ms.is_primary
			 FROM sections s
			 JOIN member_sections ms ON s.id = ms.section_id
			 WHERE ms.member_id = ?
			 ORDER BY ms.is_primary DESC, s.display_order ASC`
		)
		.bind(memberId)
		.all<{
			id: string;
			name: string;
			abbreviation: string;
			parent_section_id: string | null;
			display_order: number;
			is_active: number;
			is_primary: number;
		}>();

	return result.results.map((s) => ({
		id: s.id,
		name: s.name,
		abbreviation: s.abbreviation,
		parentSectionId: s.parent_section_id,
		displayOrder: s.display_order,
		isActive: s.is_active === 1
	}));
}

/**
 * Calculate attendance summary statistics
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

	return {
		totalEvents,
		totalMembers,
		averageAttendance
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
			email: string;
			name: string | null;
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
			const memberSections = await loadMemberSections(db, member.id);
			const primarySection = memberSections.length > 0 ? memberSections[0] : null;

			return {
				id: member.id,
				name: member.name ?? member.email,
				email: member.email,
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
