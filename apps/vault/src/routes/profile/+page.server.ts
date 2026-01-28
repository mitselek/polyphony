// Profile page server load - fetch current member data
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw new Error('Database not available');
	}

	// Authenticate member - redirects to /login if not authenticated
	try {
		const member = await getAuthenticatedMember(db, cookies);
		return { member };
	} catch (error) {
		// Not authenticated - redirect to login
		redirect(302, '/login');
	}
};
