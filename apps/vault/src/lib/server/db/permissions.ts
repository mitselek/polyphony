// Permission utilities for role-based access control

export type Role = 'admin' | 'librarian' | 'singer';

/**
 * Get a member's role by their ID
 */
export async function getMemberRole(
	db: D1Database,
	memberId: string
): Promise<Role | null> {
	const result = await db
		.prepare('SELECT role FROM members WHERE id = ?')
		.bind(memberId)
		.first<{ role: Role }>();

	return result?.role ?? null;
}

/**
 * Check if a role has admin-level permissions
 */
export function isAdminRole(role: Role): boolean {
	return role === 'admin';
}

/**
 * Check if a role can upload scores (admin or librarian)
 */
export function canUploadScores(role: Role): boolean {
	return role === 'admin' || role === 'librarian';
}

/**
 * Check if a role can invite members (admin only)
 */
export function canInviteMembers(role: Role): boolean {
	return role === 'admin';
}
