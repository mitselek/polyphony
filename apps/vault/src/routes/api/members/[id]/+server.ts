// DELETE /api/members/[id] - Remove a member from the vault
import { json, error, type RequestEvent } from '@sveltejs/kit';

export async function DELETE({ params, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const currentMemberId = cookies.get('member_id');
	if (!currentMemberId) {
		throw error(401, 'Authentication required');
	}

	const targetMemberId = params.id;

	// Get current user's roles
	const currentUser = await db
		.prepare(
			`SELECT GROUP_CONCAT(role) as roles
			 FROM member_roles
			 WHERE member_id = ?`
		)
		.bind(currentMemberId)
		.first<{ roles: string | null }>();

	if (!currentUser) {
		throw error(401, 'Invalid session');
	}

	const currentUserRoles = currentUser.roles?.split(',') ?? [];
	const isAdmin = currentUserRoles.some((r: string) => ['admin', 'owner'].includes(r));
	const isOwner = currentUserRoles.includes('owner');

	if (!isAdmin) {
		throw error(403, 'Admin or owner role required');
	}

	// Can't remove yourself
	if (currentMemberId === targetMemberId) {
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
