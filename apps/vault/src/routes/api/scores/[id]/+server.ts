// GET /api/scores/:id - Get score metadata
// DELETE /api/scores/:id - Soft delete score
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GET_ONE, DELETE as deleteScore } from '$lib/server/api/scores';
import { getMemberFromCookie, requireLibrarian } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async ({ params, platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');
	const member = await getMemberFromCookie(platform.env.DB, memberId);

	// All authenticated users can view score details
	if (!member) {
		throw error(401, 'Authentication required');
	}

	const result = await GET_ONE({ db: platform.env.DB, scoreId: params.id });

	if (!result) {
		throw error(404, 'Score not found');
	}

	return json(result);
};

export const DELETE: RequestHandler = async ({ params, platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');

	// Require at least librarian role to delete scores
	const auth = await requireLibrarian({ db: platform.env.DB, memberId });
	if (!auth.authorized) {
		throw error(auth.status ?? 401, auth.error ?? 'Unauthorized');
	}

	const result = await deleteScore({
		db: platform.env.DB,
		scoreId: params.id,
		memberId: auth.member!.id
	});

	if (!result.deleted) {
		throw error(404, 'Score not found');
	}

	return json({ deleted: true });
};
