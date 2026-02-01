import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById } from '$lib/server/db/members';
import { canUploadScores } from '$lib/server/auth/permissions';
import { getWorkById } from '$lib/server/db/works';
import { getEditionsByWorkId } from '$lib/server/db/editions';
import { getAllSections } from '$lib/server/db/sections';
import { DEFAULT_ORG_ID } from '$lib/server/constants';

async function checkCanManage(db: D1Database, memberId: string | undefined): Promise<boolean> {
	if (!memberId) return false;
	const member = await getMemberById(db, memberId);
	return member ? canUploadScores(member) : false;
}

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const workId = params.id;
	if (!workId) throw error(400, 'Work ID is required');

	const work = await getWorkById(db, workId);
	if (!work) throw error(404, 'Work not found');

	// TODO: Get orgId from subdomain routing (#165)
	const orgId = DEFAULT_ORG_ID;

	const [editions, sections, canManage] = await Promise.all([
		getEditionsByWorkId(db, workId),
		getAllSections(db, orgId),
		checkCanManage(db, cookies.get('member_id'))
	]);

	return { work, editions, sections, canManage };
};
