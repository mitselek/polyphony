// API endpoint for managing member roles
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedMember, assertAdmin, isOwner as checkIsOwner } from '$lib/server/auth/middleware';
import { parseBody, updateRolesSchema } from '$lib/server/validation/schemas';

export const POST: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);
	const isOwner = checkIsOwner(currentMember);

	// Validate request body with Zod
	const { role, action } = await parseBody(request, updateRolesSchema);

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
					.bind(targetMemberId, role, currentMember.id)
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
