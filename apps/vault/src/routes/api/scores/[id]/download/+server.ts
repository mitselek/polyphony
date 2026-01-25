// GET /api/scores/:id/download - Download score PDF
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DOWNLOAD } from '$lib/server/api/scores';
import { requireSinger } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async ({ params, platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');

	// Require at least singer role to download scores
	const auth = await requireSinger({ db: platform.env.DB, memberId });
	if (!auth.authorized) {
		throw error(auth.status ?? 401, auth.error ?? 'Unauthorized');
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
