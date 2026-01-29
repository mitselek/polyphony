import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById } from '$lib/server/db/members';
import { getEditionById } from '$lib/server/db/editions';
import { getWorkById } from '$lib/server/db/works';
import { getAllSections } from '$lib/server/db/sections';
import { canUploadScores } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const edition = await getEditionById(db, params.id);
	if (!edition) {
		throw error(404, 'Edition not found');
	}

	// Get the parent work
	const work = await getWorkById(db, edition.workId);
	if (!work) {
		throw error(404, 'Work not found');
	}

	// Get sections for displaying linked sections
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
		edition,
		work,
		sections,
		canManage
	};
};
