import type { PageServerLoad } from './$types';
import { getMemberById } from '$lib/server/db/members';
import { canUploadScores, canDeleteScores } from '$lib/server/auth/permissions';

interface Score {
	id: string;
	title: string;
	composer: string | null;
	arranger: string | null;
	license_type: string;
	uploaded_at: string;
}

interface ScoresResponse {
	scores: Score[];
}

export const load: PageServerLoad = async ({ fetch, platform, cookies }) => {
	const response = await fetch('/api/scores');
	const data = (await response.json()) as ScoresResponse;

	// Get current user's permissions
	let canUpload = false;
	let canDelete = false;

	const db = platform?.env?.DB;
	const memberId = cookies.get('member_id');

	if (db && memberId) {
		const member = await getMemberById(db, memberId);
		if (member) {
			canUpload = canUploadScores(member);
			canDelete = canDeleteScores(member);
		}
	}

	return {
		scores: data.scores ?? [],
		canUpload,
		canDelete
	};
};
