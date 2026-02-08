// Registration success page - get subdomain from query param
// Issue #220

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const subdomain = url.searchParams.get('subdomain') || '';

	return {
		subdomain
	};
};
