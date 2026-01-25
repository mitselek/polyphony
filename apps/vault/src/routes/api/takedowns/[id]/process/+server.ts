// POST /api/takedowns/[id]/process - Admin-only process takedown request
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processTakedown } from '$lib/server/db/takedowns';
import { getMemberRole, type Role } from '$lib/server/db/permissions';

const ADMIN_ROLES: Role[] = ['owner', 'admin'];

interface ProcessRequest {
	action: 'approve' | 'reject';
	notes?: string;
}

export const POST: RequestHandler = async ({ request, params, platform, cookies }) => {
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

	try {
		const body = await request.json() as ProcessRequest;

		if (body.action !== 'approve' && body.action !== 'reject') {
			return json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
		}

		const status = body.action === 'approve' ? 'approved' : 'rejected';
		const success = await processTakedown(
			db,
			params.id,
			status,
			memberId,
			body.notes || null
		);

		if (!success) {
			return json({ error: 'Takedown request not found' }, { status: 404 });
		}

		return json({ 
			success: true, 
			message: `Takedown request ${body.action}d successfully` 
		});
	} catch (error) {
		console.error('Process takedown error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
