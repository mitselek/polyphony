// Role database operations
// Centralized functions for managing member roles

import type { Role } from '$lib/types';
import { DEFAULT_ORG_ID } from '$lib/config';

/**
 * Add a role to a member
 * @returns true if role was added, false if already exists
 */
export async function addMemberRole(
	db: D1Database,
	memberId: string,
	role: Role,
	grantedBy: string | null = null,
	orgId: string = DEFAULT_ORG_ID
): Promise<boolean> {
	// Check if role already exists
	const existing = await db
		.prepare(
			`SELECT 1 FROM member_roles WHERE member_id = ? AND org_id = ? AND role = ?`
		)
		.bind(memberId, orgId, role)
		.first();

	if (existing) {
		return false; // Role already exists
	}

	await db
		.prepare(
			`INSERT INTO member_roles (member_id, org_id, role, granted_by, granted_at)
			 VALUES (?, ?, ?, ?, datetime('now'))`
		)
		.bind(memberId, orgId, role, grantedBy)
		.run();

	return true;
}

/**
 * Remove a role from a member
 * @returns true if role was removed, false if didn't exist
 */
export async function removeMemberRole(
	db: D1Database,
	memberId: string,
	role: Role,
	orgId: string = DEFAULT_ORG_ID
): Promise<boolean> {
	const result = await db
		.prepare(`DELETE FROM member_roles WHERE member_id = ? AND org_id = ? AND role = ?`)
		.bind(memberId, orgId, role)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Get all roles for a member in an organization
 */
export async function getMemberRoles(
	db: D1Database,
	memberId: string,
	orgId: string = DEFAULT_ORG_ID
): Promise<Role[]> {
	const { results } = await db
		.prepare(`SELECT role FROM member_roles WHERE member_id = ? AND org_id = ?`)
		.bind(memberId, orgId)
		.all<{ role: Role }>();

	return results.map((r) => r.role);
}

/**
 * Check if a member has a specific role in an organization
 */
export async function memberHasRole(
	db: D1Database,
	memberId: string,
	role: Role,
	orgId: string = DEFAULT_ORG_ID
): Promise<boolean> {
	const existing = await db
		.prepare(
			`SELECT 1 FROM member_roles WHERE member_id = ? AND org_id = ? AND role = ?`
		)
		.bind(memberId, orgId, role)
		.first();

	return existing !== null;
}

/**
 * Count members with a specific role in an organization
 * Useful for preventing removal of last owner
 */
export async function countMembersWithRole(
	db: D1Database,
	role: Role,
	orgId: string = DEFAULT_ORG_ID
): Promise<number> {
	const result = await db
		.prepare(`SELECT COUNT(*) as count FROM member_roles WHERE role = ? AND org_id = ?`)
		.bind(role, orgId)
		.first<{ count: number }>();

	return result?.count ?? 0;
}

/**
 * Batch add multiple roles to a member
 */
export async function addMemberRoles(
	db: D1Database,
	memberId: string,
	roles: Role[],
	grantedBy: string | null = null,
	orgId: string = DEFAULT_ORG_ID
): Promise<void> {
	if (roles.length === 0) return;

	const statements = roles.map((role) =>
		db
			.prepare(
				`INSERT INTO member_roles (member_id, org_id, role, granted_by, granted_at)
				 VALUES (?, ?, ?, ?, datetime('now'))`
			)
			.bind(memberId, orgId, role, grantedBy)
	);

	await db.batch(statements);
}
