// API endpoint for managing member roles
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Role } from '$lib/types';

export const POST: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const currentMemberId = cookies.get('member_id');
	if (!currentMemberId) {
		throw error(401, 'Authentication required');
	}

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
	const isAdmin = currentUserRoles.some((r) => ['admin', 'owner'].includes(r));
	const isOwner = currentUserRoles.includes('owner');

	if (!isAdmin) {
		throw error(403, 'Admin or owner role required');
	}

	const { role, action } = (await request.json()) as { role: Role; action: 'add' | 'remove' };

	if (!['owner', 'admin', 'librarian'].includes(role)) {
		throw error(400, 'Invalid role');
	}

	if (!['add', 'remove'].includes(action)) {
		throw error(400, 'Invalid action');
	}

	// Only owners can manage owner role
	if (role === 'owner' && !isOwner) {
		throw error(403, 'Only owners can manage owner role');
	}

	const targetMemberId = params.id;

	// Prevent removing last owner
	if (role === 'owner' && action === 'remove') {
		const ownerCount = await db
			.prepare(`SELECT COUNT(*) as count FROM member_roles WHERE role = 'owner'`)
			.first<{ count: number }>();

		if (ownerCount && ownerCount.count <= 1) {
			throw error(400, 'Cannot remove the last owner');
		}
	}

	try {
		if (action === 'add') {
			// Check if role already exists
			const existing = await db
				.prepare(
					`SELECT 1 FROM member_roles
					 WHERE member_id = ? AND role = ?`
				)
				.bind(targetMemberId, role)
				.first();

			if (!existing) {
				await db
					.prepare(
						`INSERT INTO member_roles (member_id, role, granted_by, granted_at)
						 VALUES (?, ?, ?, datetime('now'))`
					)
					.bind(targetMemberId, role, currentMemberId)
					.run();
			}
		} else {
			// Remove role
			await db
				.prepare(`DELETE FROM member_roles WHERE member_id = ? AND role = ?`)
				.bind(targetMemberId, role)
				.run();
		}

		return json({ success: true });
	} catch (err) {
		console.error('Failed to update role:', err);
		throw error(500, 'Failed to update role');
	}
};
