import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('/api/scores');
	const data = (await response.json()) as ScoresResponse;

	return {
		scores: data.scores ?? []
	};
};
