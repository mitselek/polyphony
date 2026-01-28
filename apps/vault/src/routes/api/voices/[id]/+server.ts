// API endpoint for managing individual voices
// PATCH /api/voices/[id] - Toggle voice active status
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { toggleVoiceActive, getVoiceById } from '$lib/server/db/voices';

export async function PATCH({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: require admin
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	const voiceId = params.id;
	if (!voiceId) {
		throw error(400, 'Voice ID is required');
	}

	// Parse request body
	const body = (await request.json()) as { isActive?: boolean };

	if (typeof body.isActive !== 'boolean') {
		return json({ error: 'isActive must be a boolean' }, { status: 400 });
	}

	// Toggle the voice
	const updated = await toggleVoiceActive(db, voiceId, body.isActive);

	if (!updated) {
		throw error(404, 'Voice not found');
	}

	// Return updated voice
	const voice = await getVoiceById(db, voiceId);
	return json(voice);
}
