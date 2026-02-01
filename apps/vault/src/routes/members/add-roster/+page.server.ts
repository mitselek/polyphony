// Server load for add roster member page
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';
import { DEFAULT_ORG_ID } from '$lib/server/constants';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Authenticate and authorize
	const currentUser = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentUser);

	// TODO: Get orgId from subdomain routing (#165)
	const orgId = DEFAULT_ORG_ID;

	// Load available voices and sections for multi-select
	const availableVoices = await getActiveVoices(db);
	const availableSections = await getActiveSections(db, orgId);

	return {
		availableVoices,
		availableSections
	};
};
