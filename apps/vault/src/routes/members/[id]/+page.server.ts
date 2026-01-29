// Member profile page server load - fetch member by ID
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMemberById, getAllMembers } from '$lib/server/db/members';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw new Error('Database not available');
	}

	// Authenticate current user (optional - page is viewable, but admin controls need auth)
	let currentUser = null;
	let isOwner = false;
	let isAdmin = false;
	let ownerCount = 0;
	
	try {
		currentUser = await getAuthenticatedMember(db, cookies);
		isOwner = currentUser.roles.includes('owner');
		isAdmin = currentUser.roles.some((r) => ['admin', 'owner'].includes(r));
		
		// Count owners for "last owner" check
		if (isOwner) {
			const allMembers = await getAllMembers(db);
			ownerCount = allMembers.filter((m) => m.roles.includes('owner')).length;
		}
	} catch {
		// Not authenticated - that's okay, just no admin controls
	}

	const member = await getMemberById(db, params.id);

	if (!member) {
		error(404, 'Member not found');
	}

	// Get available voices and sections for admin dropdowns
	let availableVoices: Awaited<ReturnType<typeof getActiveVoices>> = [];
	let availableSections: Awaited<ReturnType<typeof getActiveSections>> = [];
	
	if (isAdmin) {
		availableVoices = await getActiveVoices(db);
		availableSections = await getActiveSections(db);
	}

	return {
		member: {
			id: member.id,
			email: member.email_id,
			email_id: member.email_id,
			name: member.name,
			nickname: member.nickname,
			voices: member.voices,
			sections: member.sections,
			joined_at: member.joined_at,
			roles: member.roles
		},
		currentUserId: currentUser?.id ?? null,
		isOwner,
		isAdmin,
		ownerCount,
		availableVoices,
		availableSections
	};
};
