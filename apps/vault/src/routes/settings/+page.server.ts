// Settings page server load function
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getAllSettings } from '$lib/server/db/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Load settings
	const settings = await getAllSettings(db);

	return {
		settings
	};
};
