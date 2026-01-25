// Server load for invite page - check permissions
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');
	if (!memberId) {
		throw error(401, 'Authentication required');
	}

	// Get current user to check permissions
	const currentUser = await db
		.prepare(
			`SELECT GROUP_CONCAT(role) as roles
			 FROM member_roles
			 WHERE member_id = ?`
		)
		.bind(memberId)
		.first<{ roles: string | null }>();

	if (!currentUser) {
		throw error(401, 'Invalid session');
	}

	const userRoles = currentUser.roles?.split(',') ?? [];
	const canInvite = userRoles.some((r) => ['admin', 'owner'].includes(r));

	if (!canInvite) {
		throw error(403, 'Insufficient permissions - admin or owner role required');
	}

	return {
		isOwner: userRoles.includes('owner')
	};
};
