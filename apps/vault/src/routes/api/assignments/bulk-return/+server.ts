// Bulk return copies API
// Issue #126 - Collection Reminders
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMemberById } from '$lib/server/db/members';
import { canUploadScores } from '$lib/server/auth/permissions';
import { bulkReturnCopies } from '$lib/server/db/inventory-reports';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database unavailable' }, { status: 500 });
	}

	// Auth check
	const memberId = cookies.get('member_id');
	if (!memberId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Permission check - must be librarian/admin/owner
	const member = await getMemberById(db, memberId);
	if (!canUploadScores(member)) {
		return json({ error: 'Permission denied' }, { status: 403 });
	}

	// Parse request body
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	// Validate assignmentIds
	if (typeof body !== 'object' || body === null) {
		return json({ error: 'Request body must be an object' }, { status: 400 });
	}

	const { assignmentIds } = body as { assignmentIds?: unknown };

	if (!Array.isArray(assignmentIds)) {
		return json({ error: 'assignmentIds must be an array' }, { status: 400 });
	}

	if (!assignmentIds.every((id) => typeof id === 'string')) {
		return json({ error: 'All assignment IDs must be strings' }, { status: 400 });
	}

	// Perform bulk return
	const count = await bulkReturnCopies(db, assignmentIds);

	return json({ returned: count });
};
