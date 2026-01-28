// Settings page server load function
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getAllSettings } from '$lib/server/db/settings';
import { getAllVoices } from '$lib/server/db/voices';
import { getAllSections } from '$lib/server/db/sections';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Load settings, voices, and sections
	const [settings, voices, sections] = await Promise.all([
		getAllSettings(db),
		getAllVoices(db),
		getAllSections(db)
	]);

	return {
		settings,
		voices,
		sections
	};
};
