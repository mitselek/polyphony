// Server-side loader for roster table page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getRosterView } from '$lib/server/db/roster';
import { getSeasonByDate, getSeason, getSeasonNavigation, getSeasonDateRange, type Season } from '$lib/server/db/seasons';
import type { Section } from '$lib/types';

interface SectionRow {
	id: string;
	org_id: string;
	name: string;
	abbreviation: string;
	parent_section_id: string | null;
	display_order: number;
	is_active: number;
}

interface RosterFilters {
	orgId?: string;
	start?: string;
	end?: string;
	sectionId?: string;
}

/**
 * Get unique primary sections that have singers assigned
 */
async function getActiveSections(db: D1Database, orgId: string): Promise<Section[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT s.id, s.org_id, s.name, s.abbreviation, s.parent_section_id, s.display_order, s.is_active
			 FROM sections s
			 JOIN member_sections ms ON s.id = ms.section_id
			 WHERE ms.is_primary = 1 AND s.is_active = 1 AND s.org_id = ?
			 ORDER BY s.display_order`
		)
		.bind(orgId)
		.all<SectionRow>();

	return results.map((row) => ({
		id: row.id,
		orgId: row.org_id,
		name: row.name,
		abbreviation: row.abbreviation,
		parentSectionId: row.parent_section_id,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	}));
}

export const load: PageServerLoad = async ({ platform, cookies, url, locals }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	const currentMember = await getAuthenticatedMember(db, cookies);
	const orgId = locals.org.id;

	// Parse params from URL
	const seasonIdParam = url.searchParams.get('seasonId');
	const sectionIdParam = url.searchParams.get('sectionId');

	// Resolve season (same pattern as /events page)
	let season: Season | null = null;

	if (seasonIdParam) {
		season = await getSeason(db, seasonIdParam);
	}

	if (!season) {
		// Default to current season by date
		const today = new Date().toISOString().split('T')[0];
		season = await getSeasonByDate(db, orgId, today);
	}

	// Get season date range (end is start of next season, or null if unbounded)
	const dateRange = season ? await getSeasonDateRange(db, season) : { start: undefined, end: undefined };

	// Build filters from season date range
	const filters: RosterFilters = {
		orgId,
		start: dateRange.start,
		end: dateRange.end ?? undefined,
		...(sectionIdParam && { sectionId: sectionIdParam })
	};

	const [roster, sections, seasonNav] = await Promise.all([
		getRosterView(db, filters),
		getActiveSections(db, orgId),
		season ? getSeasonNavigation(db, orgId, season.id) : Promise.resolve({ prev: null, next: null })
	]);

	// Determine if current user can manage others' participation
	const canManageParticipation = currentMember.roles.some(r => 
		['conductor', 'section_leader', 'owner'].includes(r)
	);

	return { 
		roster, 
		sections, 
		filters,
		currentMemberId: currentMember.id,
		canManageParticipation,
		season: season ? { id: season.id, name: season.name } : null,
		seasonNav
	};
};
