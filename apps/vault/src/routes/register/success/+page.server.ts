import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	// Must be logged in
	const memberId = cookies.get('member_id');
	if (!memberId) {
		redirect(302, '/login');
	}

	// Get subdomain from query param
	const subdomain = url.searchParams.get('subdomain');
	if (!subdomain) {
		redirect(302, '/register');
	}

	return {
		subdomain
	};
};
