// Server load for invite page - check permissions and load voices/sections
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin, isOwner } from '$lib/server/auth/middleware';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';
import { getMemberById } from '$lib/server/db/members';
import { DEFAULT_ORG_ID } from '$lib/server/constants';

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// TODO: Get orgId from subdomain routing (#165)
	const orgId = DEFAULT_ORG_ID;

	// Load active voices and sections for the form
	const [voices, sections] = await Promise.all([
		getActiveVoices(db),
		getActiveSections(db, orgId)
	]);

	// Check for roster member ID (new flow - inviting existing roster member)
	const rosterId = url.searchParams.get('rosterId');
	let rosterMember = null;

	if (rosterId) {
		rosterMember = await getMemberById(db, rosterId);
		if (!rosterMember) {
			throw error(404, 'Roster member not found');
		}
		// Roster member must not be registered yet
		if (rosterMember.email_id) {
			throw error(400, 'Member is already registered');
		}
	}

	return {
		isOwner: isOwner(member),
		voices,
		sections,
		rosterMember: rosterMember ? {
			id: rosterMember.id,
			name: rosterMember.name,
			voices: rosterMember.voices,
			sections: rosterMember.sections
		} : null
	};
};
