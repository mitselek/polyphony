// Profile page - redirects to member detail page
// GET /profile → /members/{currentUserId}
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
		// Redirect to member detail page
		redirect(302, `/members/${member.id}`);
	} catch (error) {
		// Not authenticated - redirect to login
		redirect(302, '/login');
	}
};
