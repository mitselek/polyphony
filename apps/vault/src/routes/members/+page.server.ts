// Server load for members page - list all members with roles
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPendingInvites } from '$lib/server/db/invites';

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
	const currentUser = await db
		.prepare(
			`SELECT m.id, m.email, GROUP_CONCAT(mr.role) as roles
			 FROM members m
			 LEFT JOIN member_roles mr ON m.id = mr.member_id
			 WHERE m.id = ?
			 GROUP BY m.id`
		)
		.bind(memberId)
		.first<{ id: string; email: string; roles: string | null }>();

	if (!currentUser) {
		throw error(401, 'Invalid session');
	}

	const userRoles = currentUser.roles?.split(',') ?? [];
	const canManage = userRoles.some((r) => ['admin', 'owner'].includes(r));

	if (!canManage) {
		throw error(403, 'Insufficient permissions - admin or owner role required');
	}

	// Get all members with their roles
	const membersResult = await db
		.prepare(
			`SELECT m.id, m.email, m.name, m.voice_part, m.joined_at,
			        GROUP_CONCAT(mr.role) as roles
			 FROM members m
			 LEFT JOIN member_roles mr ON m.id = mr.member_id
			 GROUP BY m.id
			 ORDER BY m.joined_at DESC`
		)
		.all<{
			id: string;
			email: string;
			name: string | null;
			voice_part: string | null;
			joined_at: string;
			roles: string | null;
		}>();

	const members = membersResult.results.map((m) => ({
		id: m.id,
		email: m.email,
		name: m.name,
		voicePart: m.voice_part,
		joinedAt: m.joined_at,
		roles: m.roles ? m.roles.split(',') : []
	}));

	// Get pending invites
	const pendingInvites = await getPendingInvites(db);
	const baseUrl = `${url.origin}/invite/accept`;
	const invites = pendingInvites.map((inv) => ({
		id: inv.id,
		name: inv.name,
		roles: inv.roles,
		voicePart: inv.voice_part,
		createdAt: inv.created_at,
		expiresAt: inv.expires_at,
		invitedBy: inv.inviter_name ?? inv.inviter_email,
		inviteLink: `${baseUrl}?token=${inv.token}`
	}));

	return {
		members,
		invites,
		currentUserId: currentUser.id,
		isOwner: userRoles.includes('owner'),
		isAdmin: userRoles.some((r) => ['admin', 'owner'].includes(r))
	};
};
