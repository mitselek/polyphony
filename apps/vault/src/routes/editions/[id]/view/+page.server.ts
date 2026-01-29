import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getEditionById } from '$lib/server/db/editions';
import { getWorkById } from '$lib/server/db/works';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const edition = await getEditionById(db, params.id);
	if (!edition) {
		throw error(404, 'Edition not found');
	}

	if (!edition.fileKey) {
		throw error(404, 'No file attached to this edition');
	}

	// Get the parent work for breadcrumb
	const work = await getWorkById(db, edition.workId);

	return {
		edition,
		work
	};
};
