// Settings page server load function
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getAllSettings } from '$lib/server/db/settings';
import { getAllVoicesWithCounts } from '$lib/server/db/voices';
import { getAllSectionsWithCounts } from '$lib/server/db/sections';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, cookies, locals }) => {
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	const orgId = locals.org.id;

	// Load settings, voices (with counts), and sections (with counts)
	const [settings, voices, sections] = await Promise.all([
		getAllSettings(db),
		getAllVoicesWithCounts(db),
		getAllSectionsWithCounts(db, orgId)
	]);

	return {
		settings,
		voices,
		sections
	};
};
