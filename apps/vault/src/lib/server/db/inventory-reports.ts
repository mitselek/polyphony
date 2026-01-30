// Inventory report queries
// Issue #123 - Missing Copies Report
// Part of Epic #106 - Phase D: Reports & Insights

export interface MissingCopyEntry {
	memberId: string;
	memberName: string;
	sectionId: string;
	sectionName: string;
	editionId: string;
	editionName: string;
	workId: string;
	workTitle: string;
	composer: string | null;
}

export interface MissingCopiesReport {
	entries: MissingCopyEntry[];
	totalMissing: number;
	editionCount: number;
}

interface MissingCopyRow {
	member_id: string;
	member_name: string;
	section_id: string;
	section_name: string;
	edition_id: string;
	edition_name: string;
	work_id: string;
	work_title: string;
	composer: string | null;
}

/**
 * Get missing copies report for an event
 *
 * Logic:
 * 1. Get all editions in event repertoire (event_works → event_work_editions)
 * 2. For each edition, find relevant sections (edition_sections)
 * 3. Find members in those sections (member_sections)
 * 4. Exclude members who already have a copy assigned (NOT EXISTS subquery)
 *
 * Uses NOT EXISTS pattern instead of LEFT JOIN + NULL check
 * to avoid row multiplication and allow SQLite short-circuit optimization.
 */
export async function getMissingCopiesForEvent(
	db: D1Database,
	eventId: string
): Promise<MissingCopiesReport> {
	const query = `
		SELECT 
			m.id as member_id,
			m.name as member_name,
			s.id as section_id,
			s.name as section_name,
			e.id as edition_id,
			e.name as edition_name,
			w.id as work_id,
			w.title as work_title,
			w.composer
		FROM event_works ew
		JOIN event_work_editions ewe ON ewe.event_work_id = ew.id
		JOIN editions e ON e.id = ewe.edition_id
		JOIN works w ON w.id = e.work_id
		JOIN edition_sections es ON es.edition_id = e.id
		JOIN member_sections ms ON ms.section_id = es.section_id
		JOIN members m ON m.id = ms.member_id
		JOIN sections s ON s.id = ms.section_id
		WHERE ew.event_id = ?
			AND m.email_id IS NOT NULL
			AND NOT EXISTS (
				SELECT 1 
				FROM physical_copies pc
				JOIN copy_assignments ca ON ca.copy_id = pc.id
				WHERE pc.edition_id = e.id
					AND ca.member_id = m.id
					AND ca.returned_at IS NULL
			)
		ORDER BY w.title, e.name, s.name, m.name
	`;

	const { results } = await db.prepare(query).bind(eventId).all<MissingCopyRow>();

	const entries: MissingCopyEntry[] = results.map((row) => ({
		memberId: row.member_id,
		memberName: row.member_name,
		sectionId: row.section_id,
		sectionName: row.section_name,
		editionId: row.edition_id,
		editionName: row.edition_name,
		workId: row.work_id,
		workTitle: row.work_title,
		composer: row.composer
	}));

	const uniqueEditions = new Set(entries.map((e) => e.editionId));

	return {
		entries,
		totalMissing: entries.length,
		editionCount: uniqueEditions.size
	};
}

/**
 * Get missing copies for a season
 * Uses season_works → season_work_editions instead of event_works
 */
export async function getMissingCopiesForSeason(
	db: D1Database,
	seasonId: string
): Promise<MissingCopiesReport> {
	const query = `
		SELECT 
			m.id as member_id,
			m.name as member_name,
			s.id as section_id,
			s.name as section_name,
			e.id as edition_id,
			e.name as edition_name,
			w.id as work_id,
			w.title as work_title,
			w.composer
		FROM season_works sw
		JOIN season_work_editions swe ON swe.season_work_id = sw.id
		JOIN editions e ON e.id = swe.edition_id
		JOIN works w ON w.id = e.work_id
		JOIN edition_sections es ON es.edition_id = e.id
		JOIN member_sections ms ON ms.section_id = es.section_id
		JOIN members m ON m.id = ms.member_id
		JOIN sections s ON s.id = ms.section_id
		WHERE sw.season_id = ?
			AND m.email_id IS NOT NULL
			AND NOT EXISTS (
				SELECT 1 
				FROM physical_copies pc
				JOIN copy_assignments ca ON ca.copy_id = pc.id
				WHERE pc.edition_id = e.id
					AND ca.member_id = m.id
					AND ca.returned_at IS NULL
			)
		ORDER BY w.title, e.name, s.name, m.name
	`;

	const { results } = await db.prepare(query).bind(seasonId).all<MissingCopyRow>();

	const entries: MissingCopyEntry[] = results.map((row) => ({
		memberId: row.member_id,
		memberName: row.member_name,
		sectionId: row.section_id,
		sectionName: row.section_name,
		editionId: row.edition_id,
		editionName: row.edition_name,
		workId: row.work_id,
		workTitle: row.work_title,
		composer: row.composer
	}));

	const uniqueEditions = new Set(entries.map((e) => e.editionId));

	return {
		entries,
		totalMissing: entries.length,
		editionCount: uniqueEditions.size
	};
}
