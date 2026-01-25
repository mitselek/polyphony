// GET /api/scores/:id - Get score metadata
// DELETE /api/scores/:id - Soft delete score
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GET_ONE, DELETE as deleteScore } from '$lib/server/api/scores';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const result = await GET_ONE({ db: platform.env.DB, scoreId: params.id });

	if (!result) {
		throw error(404, 'Score not found');
	}

	return json(result);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	// TODO: Check if user has admin/librarian role
	const memberId = 'anonymous';

	const result = await deleteScore({
		db: platform.env.DB,
		scoreId: params.id,
		memberId
	});

	if (!result.deleted) {
		throw error(404, 'Score not found');
	}

	return json({ deleted: true });
};
