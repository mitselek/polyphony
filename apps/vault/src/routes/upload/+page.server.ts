// Server load for upload page - check auth before showing form
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// If not logged in, we'll show login prompt in the page
	// If logged in but wrong role, we'll also show appropriate message

	return {
		canUpload: user?.role === 'librarian' || user?.role === 'admin'
	};
};
