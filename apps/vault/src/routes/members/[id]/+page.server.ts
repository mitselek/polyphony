// Member profile page server load - fetch member by ID
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMemberById } from '$lib/server/db/members';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw new Error('Database not available');
	}

	const member = await getMemberById(db, params.id);

	if (!member) {
		error(404, 'Member not found');
	}

	return { member };
};
