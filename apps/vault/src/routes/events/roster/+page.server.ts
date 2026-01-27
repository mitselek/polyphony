// Server-side loader for roster table page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getRosterView } from '$lib/server/db/roster';
import type { Voice, Section } from '$lib/types';

/**
 * Get all active sections for filter dropdown
 */
async function getActiveSections(db: D1Database): Promise<Section[]> {
	interface SectionRow {
		id: string;
		name: string;
		abbreviation: string;
		parent_section_id: string | null;
		display_order: number;
		is_active: number;
	}

	const { results } = await db
		.prepare(
			'SELECT id, name, abbreviation, parent_section_id, display_order, is_active FROM sections WHERE is_active = 1 ORDER BY display_order'
		)
		.all<SectionRow>();

	return results.map((row) => ({
		id: row.id,
		name: row.name,
		abbreviation: row.abbreviation,
		parentSectionId: row.parent_section_id,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	}));
}

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require authentication
	const member = await getAuthenticatedMember(db, cookies);

	// Extract filter parameters from URL
	const startParam = url.searchParams.get('start');
	const endParam = url.searchParams.get('end');
	const sectionIdParam = url.searchParams.get('sectionId');

	// Default date range: next 4 weeks from today
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const fourWeeksFromNow = new Date(today);
	fourWeeksFromNow.setDate(today.getDate() + 28);

	// Build filters with defaults
	const filters: { start?: string; end?: string; sectionId?: string } = {};

	if (startParam) {
		filters.start = startParam;
	} else {
		filters.start = today.toISOString();
	}

	if (endParam) {
		filters.end = endParam;
	} else {
		filters.end = fourWeeksFromNow.toISOString();
	}

	if (sectionIdParam) {
		filters.sectionId = sectionIdParam;
	}

	// Load roster data and sections for filter
	const [roster, sections] = await Promise.all([
		getRosterView(db, filters),
		getActiveSections(db)
	]);

	return {
		roster,
		sections,
		filters
	};
};
