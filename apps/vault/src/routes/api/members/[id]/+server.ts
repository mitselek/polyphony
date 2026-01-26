// DELETE /api/members/[id] - Remove a member from the vault
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin, isOwner as checkIsOwner } from '$lib/server/auth/middleware';

export async function DELETE({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);
	const isOwner = checkIsOwner(currentMember);

	const targetMemberId = params.id;

	// Can't remove yourself
	if (currentMember.id === targetMemberId) {
		throw error(400, 'Cannot remove yourself');
	}

	// Get target member's roles
	const targetUser = await db
		.prepare(
			`SELECT GROUP_CONCAT(role) as roles
			 FROM member_roles
			 WHERE member_id = ?`
		)
		.bind(targetMemberId)
		.first<{ roles: string | null }>();

	if (!targetUser) {
		throw error(404, 'Member not found');
	}

	const targetUserRoles = targetUser.roles?.split(',') ?? [];
	const targetIsOwner = targetUserRoles.includes('owner');

	// Only owners can remove other owners
	if (targetIsOwner && !isOwner) {
		throw error(403, 'Only owners can remove other owners');
	}

	// Delete member (roles will cascade delete due to foreign key)
	await db
		.prepare('DELETE FROM members WHERE id = ?')
		.bind(targetMemberId)
		.run();

	return json({ success: true });
}
