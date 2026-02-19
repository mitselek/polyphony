// GET /api/takedowns - Admin-only list of takedown requests (org-scoped)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTakedownRequests } from '$lib/server/db/takedowns';
import { getMemberRole, isAdminRole } from '$lib/server/db/permissions';

export const GET: RequestHandler = async ({ url, platform, cookies, locals }) => {
	const org = locals.org;
	if (!org) {
		return json({ error: 'Organization context required' }, { status: 500 });
	}

	const memberId = cookies.get('member_id');

	if (!memberId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database unavailable' }, { status: 500 });
	}

	const role = await getMemberRole(db, memberId);
	if (!role || !isAdminRole(role)) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
	const takedowns = await listTakedownRequests(db, org.id, status || undefined);

	return json({ takedowns });
};
