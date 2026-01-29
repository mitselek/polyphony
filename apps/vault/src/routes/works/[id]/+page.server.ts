import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById } from '$lib/server/db/members';
import { canUploadScores } from '$lib/server/auth/permissions';
import { getWorkById } from '$lib/server/db/works';
import { getEditionsByWorkId } from '$lib/server/db/editions';
import { getAllSections } from '$lib/server/db/sections';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const workId = params.id;
	if (!workId) {
		throw error(400, 'Work ID is required');
	}

	// Get work
	const work = await getWorkById(db, workId);
	if (!work) {
		throw error(404, 'Work not found');
	}

	// Get editions for this work
	const editions = await getEditionsByWorkId(db, workId);

	// Get all sections for edition form
	const sections = await getAllSections(db);

	// Get current user's permissions
	let canManage = false;
	const memberId = cookies.get('member_id');

	if (memberId) {
		const member = await getMemberById(db, memberId);
		if (member) {
			canManage = canUploadScores(member);
		}
	}

	return {
		work,
		editions,
		sections,
		canManage
	};
};
