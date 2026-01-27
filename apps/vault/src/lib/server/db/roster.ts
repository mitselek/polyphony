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
 * Get comprehensive roster view with events, members, and participation
 * @param db - D1 Database instance
 * @param filters - Optional filters for date range and section
 * @returns Complete roster view with events, members, and summary statistics
 */
export async function getRosterView(
	db: D1Database,
	filters?: RosterViewFilters
): Promise<RosterView> {
	// Build events query with date filtering
	let eventsQuery = 'SELECT * FROM events';
	const eventsParams: string[] = [];

	if (filters?.startDate && filters?.endDate) {
		eventsQuery += ' WHERE date >= ? AND date <= ?';
		eventsParams.push(filters.startDate, filters.endDate);
	} else if (filters?.startDate) {
		eventsQuery += ' WHERE date >= ?';
		eventsParams.push(filters.startDate);
	} else if (filters?.endDate) {
		eventsQuery += ' WHERE date <= ?';
		eventsParams.push(filters.endDate);
	}

	eventsQuery += ' ORDER BY date DESC';

	// Fetch events
	const eventsResult = await db
		.prepare(eventsQuery)
		.bind(...eventsParams)
		.all<{
			id: string;
			name: string;
			date: string;
			type: string;
		}>();

	const events = eventsResult.results;

	// Build members query with optional section filtering
	let membersQuery = 'SELECT DISTINCT m.* FROM members m';
	const membersParams: string[] = [];

	if (filters?.sectionId) {
		membersQuery += ' JOIN member_sections ms ON m.id = ms.member_id WHERE ms.section_id = ?';
		membersParams.push(filters.sectionId);
	}

	membersQuery += ' ORDER BY m.name ASC, m.email ASC';

	// Fetch members
	const membersResult = await db
		.prepare(membersQuery)
		.bind(...membersParams)
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

	// Fetch all sections for member lookups
	const sectionsResult = await db.prepare('SELECT * FROM sections').all<{
		id: string;
		name: string;
		abbreviation: string;
		parent_section_id: string | null;
		display_order: number;
		is_active: number;
	}>();

	const sectionsMap = new Map<string, Section>(
		sectionsResult.results.map((s) => [
			s.id,
			{
				id: s.id,
				name: s.name,
				abbreviation: s.abbreviation,
				parentSectionId: s.parent_section_id,
				displayOrder: s.display_order,
				isActive: s.is_active === 1
			}
		])
	);

	// Fetch all voices for member lookups
	const voicesResult = await db.prepare('SELECT * FROM voices').all<{
		id: string;
		name: string;
		abbreviation: string;
		category: 'vocal' | 'instrumental';
		range_group: string | null;
		display_order: number;
		is_active: number;
	}>();

	const voicesMap = new Map<string, Voice>(
		voicesResult.results.map((v) => [
			v.id,
			{
				id: v.id,
				name: v.name,
				abbreviation: v.abbreviation,
				category: v.category,
				rangeGroup: v.range_group,
				displayOrder: v.display_order,
				isActive: v.is_active === 1
			}
		])
	);

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
			// Fetch member sections
			const memberSectionsResult = await db
				.prepare(
					`SELECT s.id, s.name, s.abbreviation, s.parent_section_id, s.display_order, s.is_active, ms.is_primary
					 FROM sections s
					 JOIN member_sections ms ON s.id = ms.section_id
					 WHERE ms.member_id = ?
					 ORDER BY ms.is_primary DESC, s.display_order ASC`
				)
				.bind(member.id)
				.all<{
					id: string;
					name: string;
					abbreviation: string;
					parent_section_id: string | null;
					display_order: number;
					is_active: number;
					is_primary: number;
				}>();

			const memberSections: Section[] = memberSectionsResult.results.map((s) => ({
				id: s.id,
				name: s.name,
				abbreviation: s.abbreviation,
				parentSectionId: s.parent_section_id,
				displayOrder: s.display_order,
				isActive: s.is_active === 1
			}));

			const primarySection = memberSections.length > 0 ? memberSections[0] : null;

			// Note: Voice fetching not needed for roster view in current spec
			// But keeping structure consistent with member model

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

	const summary: RosterSummary = {
		totalEvents,
		totalMembers,
		averageAttendance
	};

	return {
		events: rosterEvents,
		members: rosterMembers,
		summary
	};
}
