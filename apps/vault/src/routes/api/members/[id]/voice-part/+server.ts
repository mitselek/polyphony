// API endpoint for updating member voice part
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const VALID_VOICE_PARTS = ['S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB'];

export const POST: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const currentMemberId = cookies.get('member_id');
	if (!currentMemberId) {
		throw error(401, 'Authentication required');
	}

	// Get current user's roles
	const currentUser = await db
		.prepare(
			`SELECT GROUP_CONCAT(role) as roles
			 FROM member_roles
			 WHERE member_id = ?`
		)
		.bind(currentMemberId)
		.first<{ roles: string | null }>();

	if (!currentUser) {
		throw error(401, 'Invalid session');
	}

	const currentUserRoles = currentUser.roles?.split(',') ?? [];
	const isAdmin = currentUserRoles.some((r) => ['admin', 'owner'].includes(r));

	if (!isAdmin) {
		throw error(403, 'Admin or owner role required');
	}

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
