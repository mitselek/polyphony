// GET /api/takedowns - Admin-only list of takedown requests
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTakedownRequests } from '$lib/server/db/takedowns';
import { getMemberRole, type Role } from '$lib/server/db/permissions';

const ADMIN_ROLES: Role[] = ['owner', 'admin'];

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	const memberId = cookies.get('member_id');
	
	if (!memberId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database unavailable' }, { status: 500 });
	}

	const role = await getMemberRole(db, memberId);
	if (!role || !ADMIN_ROLES.includes(role)) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
	const takedowns = await listTakedownRequests(db, status || undefined);

	return json({ takedowns });
};
