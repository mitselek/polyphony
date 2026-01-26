// API endpoint for updating member voice part
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';

const VALID_VOICE_PARTS = ['S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB'];

export const POST: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);

	const { voicePart } = (await request.json()) as { voicePart: string | null };

	// Validate voice part
	if (voicePart !== null && !VALID_VOICE_PARTS.includes(voicePart)) {
		throw error(400, 'Invalid voice part');
	}

	const targetMemberId = params.id;

	try {
		await db
			.prepare(`UPDATE members SET voice_part = ? WHERE id = ?`)
			.bind(voicePart, targetMemberId)
			.run();

		return json({ success: true });
	} catch (err) {
		console.error('Failed to update voice part:', err);
		throw error(500, 'Failed to update voice part');
	}
};
