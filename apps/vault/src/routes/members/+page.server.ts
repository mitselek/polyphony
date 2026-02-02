// Server load for members page - list all members with roles
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getPendingInvites } from '$lib/server/db/invites';
import { getAllMembers } from '$lib/server/db/members';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ platform, cookies, url, locals }) => {
	const db = platform?.env?.DB;
	if (!db) {
		logger.error('Database not available');
		throw error(500, 'Database not available');
	}

	// Authenticate and get current user
	let currentUser;
	try {
		logger.info('Authenticating member...');
		currentUser = await getAuthenticatedMember(db, cookies);
		logger.info('Authentication successful:', { id: currentUser.id, name: currentUser.name, roles: currentUser.roles });
	} catch (err) {
		// Not authenticated - redirect to login
		logger.warn('Authentication failed, redirecting to login:', err instanceof Error ? err.message : err);
		redirect(302, '/login');
	}

	const canManage = currentUser.roles.some((r) => ['admin', 'owner'].includes(r));

	if (!canManage) {
		logger.warn('User lacks admin/owner role:', { id: currentUser.id, roles: currentUser.roles });
		throw error(403, 'Insufficient permissions - admin or owner role required');
	}

	// Get all members with their roles, voices, and sections
	logger.info('Loading all members...');
	const allMembers = await getAllMembers(db);
	logger.info('Loaded members:', { count: allMembers.length });

	// Format for frontend and sort by nickname (if set) or name
	const members = allMembers
		.map((m) => ({
			id: m.id,
			email: m.email_id, // For display
			email_id: m.email_id, // For registration check (null = roster-only)
			name: m.name,
			nickname: m.nickname,
			voices: m.voices,
			sections: m.sections,
			joinedAt: m.joined_at,
			roles: m.roles
		}))
		.sort((a, b) => {
			const nameA = (a.nickname ?? a.name).toLowerCase();
			const nameB = (b.nickname ?? b.name).toLowerCase();
			return nameA.localeCompare(nameB);
		});

	const orgId = locals.org.id;

	// Get pending invites for this organization
	logger.info('Loading pending invites...');
	const pendingInvites = await getPendingInvites(db, orgId);
	logger.info('Loaded invites:', { count: pendingInvites.length });
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

	// Create map of roster member IDs to their invite links
	const pendingInviteLinks: Record<string, string> = {};
	for (const inv of pendingInvites) {
		pendingInviteLinks[inv.roster_member_id] = `${baseUrl}?token=${inv.token}`;
	}

	// Get available voices and sections for adding
	logger.info('Loading available voices and sections...');
	const availableVoices = await getActiveVoices(db);
	const availableSections = await getActiveSections(db, orgId);
	logger.info('Loaded:', { voices: availableVoices.length, sections: availableSections.length });

	logger.info('Page load complete');
	return {
		members,
		invites,
		pendingInviteLinks, // Map of memberId -> inviteLink
		availableVoices,
		availableSections,
		currentUserId: currentUser.id,
		isOwner: currentUser.roles.includes('owner'),
		isAdmin: currentUser.roles.some((r) => ['admin', 'owner'].includes(r))
	};
};
