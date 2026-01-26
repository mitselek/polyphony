// Server load for members page - list all members with roles
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPendingInvites } from '$lib/server/db/invites';
import { getAllMembers, getMemberById } from '$lib/server/db/members';

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = cookies.get('member_id');
	if (!memberId) {
		throw error(401, 'Authentication required');
	}

	// Get current user to check permissions
	const currentUser = await getMemberById(db, memberId);

	if (!currentUser) {
		throw error(401, 'Invalid session');
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
		email: m.email,
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
		name: inv.name,
		roles: inv.roles,
		voices: inv.voices,
		sections: inv.sections,
		createdAt: inv.created_at,
		expiresAt: inv.expires_at,
		invitedBy: inv.inviter_name ?? inv.inviter_email,
		inviteLink: `${baseUrl}?token=${inv.token}`
	}));

	return {
		members,
		invites,
		currentUserId: currentUser.id,
		isOwner: currentUser.roles.includes('owner'),
		isAdmin: currentUser.roles.some((r) => ['admin', 'owner'].includes(r))
	};
};
