// Server load for members page - list all members with roles
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getPendingInvites } from '$lib/server/db/invites';
import { getAllMembers } from '$lib/server/db/members';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Authenticate and get current user
	let currentUser;
	try {
		currentUser = await getAuthenticatedMember(db, cookies);
	} catch (err) {
		// Not authenticated - redirect to login
		redirect(302, '/login');
	}

	const canManage = currentUser.roles.some((r) => ['admin', 'owner'].includes(r));

	if (!canManage) {
		throw error(403, 'Insufficient permissions - admin or owner role required');
	}

	// Get all members with their roles, voices, and sections
	const allMembers = await getAllMembers(db);

	// Format for frontend
	const members = allMembers.map((m) => ({
		id: m.id,
		email: m.email_id, // For display
		email_id: m.email_id, // For registration check (null = roster-only)
		name: m.name,
		voices: m.voices,
		sections: m.sections,
		joinedAt: m.joined_at,
		roles: m.roles
	}));

	// Get pending invites
	const pendingInvites = await getPendingInvites(db);
	const baseUrl = `${url.origin}/invite/accept`;
	const invites = pendingInvites.map((inv) => ({
		id: inv.id,
		roster_member_id: inv.roster_member_id,
		name: inv.roster_member_name,
		roles: inv.roles,
		voices: inv.voices,
		sections: inv.sections,
		createdAt: inv.created_at,
		expiresAt: inv.expires_at,
		invitedBy: inv.inviter_name ?? inv.inviter_email ?? 'Unknown',
		inviteLink: `${baseUrl}?token=${inv.token}`
	}));

	// Get available voices and sections for adding
	const availableVoices = await getActiveVoices(db);
	const availableSections = await getActiveSections(db);

	return {
		members,
		invites,
		availableVoices,
		availableSections,
		currentUserId: currentUser.id,
		isOwner: currentUser.roles.includes('owner'),
		isAdmin: currentUser.roles.some((r) => ['admin', 'owner'].includes(r))
	};
};
