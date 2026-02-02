// Server load for invite page - check permissions and load voices/sections
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin, isOwner } from '$lib/server/auth/middleware';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';
import { getMemberById } from '$lib/server/db/members';

export const load: PageServerLoad = async ({ platform, cookies, url, locals }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	const orgId = locals.org.id;

	// Load active voices and sections for the form
	const [voices, sections] = await Promise.all([
		getActiveVoices(db),
		getActiveSections(db, orgId)
	]);

	// Check for roster member ID (new flow - inviting existing roster member)
	const rosterId = url.searchParams.get('rosterId');
	let rosterMember = null;
	let hasPendingInvite = false;

	if (rosterId) {
		rosterMember = await getMemberById(db, rosterId);
		if (!rosterMember) {
			throw error(404, 'Roster member not found');
		}
		// Roster member must not be registered yet
		if (rosterMember.email_id) {
			throw error(400, 'Member is already registered');
		}

		// Check for existing pending invite
		const existingInvite = await db
			.prepare('SELECT id FROM invites WHERE roster_member_id = ? AND expires_at > datetime("now")')
			.bind(rosterId)
			.first();
		
		if (existingInvite) {
			hasPendingInvite = true;
		}
	}

	return {
		isOwner: isOwner(member),
		voices,
		sections,
		hasPendingInvite,
		rosterMember: rosterMember ? {
			id: rosterMember.id,
			name: rosterMember.name,
			voices: rosterMember.voices,
			sections: rosterMember.sections
		} : null
	};
};
