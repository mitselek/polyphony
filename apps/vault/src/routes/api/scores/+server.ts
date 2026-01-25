// GET /api/scores - List scores
// POST /api/scores - Upload new score
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GET as getScores, POST as createScore } from '$lib/server/api/scores';
import { requireSinger, requireLibrarian } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async ({ platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');

	// Require at least singer role to view scores
	const auth = await requireSinger({ db: platform.env.DB, memberId });
	if (!auth.authorized) {
		throw error(auth.status ?? 401, auth.error ?? 'Unauthorized');
	}

	const result = await getScores({ db: platform.env.DB });
	return json(result);
};

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');

	// Require at least librarian role to upload scores
	const auth = await requireLibrarian({ db: platform.env.DB, memberId });
	if (!auth.authorized) {
		throw error(auth.status ?? 401, auth.error ?? 'Unauthorized');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const title = formData.get('title') as string | null;
	const composer = formData.get('composer') as string | null;
	const arranger = formData.get('arranger') as string | null;
	const license_type = formData.get('license_type') as string | null;

	if (!file) {
		throw error(400, 'File is required');
	}

	if (!title) {
		throw error(400, 'Title is required');
	}

	if (!license_type || !['public_domain', 'licensed', 'owned', 'pending'].includes(license_type)) {
		throw error(400, 'Valid license_type is required');
	}

	try {
		const result = await createScore({
			db: platform.env.DB,
			body: {
				title,
				composer: composer ?? undefined,
				arranger: arranger ?? undefined,
				license_type: license_type as 'public_domain' | 'licensed' | 'owned' | 'pending'
			},
			file,
			memberId: auth.member!.id
		});

		return json(result, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Upload failed';
		throw error(400, message);
	}
};
