// Server-side loader for roster table page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getRosterView } from '$lib/server/db/roster';
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
	start?: string;
	end?: string;
	sectionId?: string;
}

/**
 * Get unique primary sections that have singers assigned
 */
async function getActiveSections(db: D1Database): Promise<Section[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT s.id, s.org_id, s.name, s.abbreviation, s.parent_section_id, s.display_order, s.is_active
			 FROM sections s
			 JOIN member_sections ms ON s.id = ms.section_id
			 WHERE ms.is_primary = 1 AND s.is_active = 1
			 ORDER BY s.display_order`
		)
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

/**
 * Build filters from URL params with sensible defaults
 * Default: one month ago to four weeks from now
 */
function buildFilters(url: URL): RosterFilters {
	const startParam = url.searchParams.get('start');
	const endParam = url.searchParams.get('end');
	const sectionIdParam = url.searchParams.get('sectionId');

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const oneMonthAgo = new Date(today);
	oneMonthAgo.setMonth(today.getMonth() - 1);

	const fourWeeksFromNow = new Date(today);
	fourWeeksFromNow.setDate(today.getDate() + 28);

	const eightWeeksFromNow = new Date(today);
	eightWeeksFromNow.setDate(today.getDate() + 56);

	return {
		start: startParam ?? oneMonthAgo.toISOString(),
		end: endParam ?? eightWeeksFromNow.toISOString(),
		...(sectionIdParam && { sectionId: sectionIdParam })
	};
}

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	const currentMember = await getAuthenticatedMember(db, cookies);

	const filters = buildFilters(url);

	const [roster, sections] = await Promise.all([
		getRosterView(db, filters),
		getActiveSections(db)
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
		canManageParticipation
	};
};
