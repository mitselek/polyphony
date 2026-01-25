// GET /api/scores/:id/download - Download score PDF
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DOWNLOAD } from '$lib/server/api/scores';
import { getMemberFromCookie } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async ({ params, platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');
	const member = await getMemberFromCookie(platform.env.DB, memberId);

	// All authenticated users can download scores
	if (!member) {
		throw error(401, 'Authentication required');
	}

	const result = await DOWNLOAD({ db: platform.env.DB, scoreId: params.id });

	if (!result) {
		throw error(404, 'Score not found');
	}

	return new Response(result.data, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${result.originalName}"`,
			'Content-Length': result.size.toString()
		}
	});
};
