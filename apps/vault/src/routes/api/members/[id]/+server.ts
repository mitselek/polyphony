// API endpoints for managing members
// DELETE /api/members/[id] - Remove a member from the vault
// PATCH /api/members/[id] - Update a member (admin only)
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin, isOwner as checkIsOwner } from '$lib/server/auth/middleware';
import { updateMemberName, updateMemberNickname } from '$lib/server/db/members';

interface UpdateMemberRequest {
	name?: string;
	nickname?: string | null;
}

// PATCH - Update member details (admin only)
export async function PATCH({ params, request, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);

	const targetMemberId = params.id;
	if (!targetMemberId) {
		throw error(400, 'Member ID is required');
	}

	// Parse request body
	const body = (await request.json()) as UpdateMemberRequest;

	// Validate name if provided
	if (body.name !== undefined) {
		if (typeof body.name !== 'string') {
			return json({ error: 'Name must be a string' }, { status: 400 });
		}

		const trimmedName = body.name.trim();
		if (trimmedName.length === 0) {
			return json({ error: 'Name cannot be empty' }, { status: 400 });
		}

		try {
			const updated = await updateMemberName(db, targetMemberId, trimmedName);
			return json(updated);
		} catch (err) {
			if (err instanceof Error && err.message.includes('already exists')) {
				return json({ error: 'A member with this name already exists' }, { status: 409 });
			}
			console.error('Failed to update member name:', err);
			return json(
				{ error: err instanceof Error ? err.message : 'Failed to update name' },
				{ status: 500 }
			);
		}
	}

	// Validate nickname if provided (can be null to clear, or string)
	if (body.nickname !== undefined) {
		// Allow null (to clear) or string
		if (body.nickname !== null && typeof body.nickname !== 'string') {
			return json({ error: 'Nickname must be a string or null' }, { status: 400 });
		}

		// Trim if string, convert empty string to null
		const trimmedNickname = body.nickname === null ? null : body.nickname.trim() || null;

		try {
			const updated = await updateMemberNickname(db, targetMemberId, trimmedNickname);
			return json(updated);
		} catch (err) {
			console.error('Failed to update member nickname:', err);
			return json(
				{ error: err instanceof Error ? err.message : 'Failed to update nickname' },
				{ status: 500 }
			);
		}
	}

	return json({ error: 'No valid fields to update' }, { status: 400 });
}

// DELETE - Remove member from vault
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
