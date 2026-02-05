// API endpoint for member i18n preferences (Issue #186)
// GET /api/profile/preferences - Get member preferences
// PATCH /api/profile/preferences - Update member preferences

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getMemberPreferences, setMemberPreferences } from '$lib/server/db/member-preferences';
import type { UpdateMemberPreferencesInput } from '$lib/types';

interface UpdatePreferencesBody {
	language?: string | null;
	locale?: string | null;
	timezone?: string | null;
}

/** Parse request body into UpdateMemberPreferencesInput */
function parseUpdateInput(body: UpdatePreferencesBody): UpdateMemberPreferencesInput {
	const input: UpdateMemberPreferencesInput = {};
	if ('language' in body) input.language = body.language;
	if ('locale' in body) input.locale = body.locale;
	if ('timezone' in body) input.timezone = body.timezone;
	return input;
}

export const GET: RequestHandler = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const member = await getAuthenticatedMember(db, cookies);
	const prefs = await getMemberPreferences(db, member.id);
	
	return json(prefs);
};

export const PATCH: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const member = await getAuthenticatedMember(db, cookies);
	const body = (await request.json()) as UpdatePreferencesBody;
	const updated = await setMemberPreferences(db, member.id, parseUpdateInput(body));
	
	return json(updated);
};
