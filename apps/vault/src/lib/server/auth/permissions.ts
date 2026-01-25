// Permission system for role-based access control

export type Role = 'owner' | 'admin' | 'librarian' | 'singer';

export type Permission =
	| 'scores:view'
	| 'scores:download'
	| 'scores:upload'
	| 'scores:delete'
	| 'members:invite'
	| 'members:manage'
	| 'vault:delete';

export interface Member {
	id: string;
	role: Role;
	email: string;
}

export interface RequireRoleResult {
	success: boolean;
	error?: string;
}

/**
 * Role hierarchy (higher index = more permissions)
 */
const ROLE_HIERARCHY: Role[] = ['singer', 'librarian', 'admin', 'owner'];

/**
 * Permission matrix - which roles have which permissions
 */
const PERMISSIONS: Record<Role, Permission[]> = {
	singer: ['scores:view', 'scores:download'],
	librarian: ['scores:view', 'scores:download', 'scores:upload', 'scores:delete'],
	admin: [
		'scores:view',
		'scores:download',
		'scores:upload',
		'scores:delete',
		'members:invite',
		'members:manage'
	],
	owner: [
		'scores:view',
		'scores:download',
		'scores:upload',
		'scores:delete',
		'members:invite',
		'members:manage',
		'vault:delete'
	]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
	return PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a member's role meets minimum required role
 */
export function requireRole(
	member: Member | null | undefined,
	minRole: Role
): RequireRoleResult {
	if (!member) {
		return { success: false, error: 'Authentication required' };
	}

	const memberRoleIndex = ROLE_HIERARCHY.indexOf(member.role);
	const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

	if (memberRoleIndex < minRoleIndex) {
		return { success: false, error: 'Insufficient permissions' };
	}

	return { success: true };
}

/**
 * Get role hierarchy level (for comparisons)
 */
export function getRoleLevel(role: Role): number {
	return ROLE_HIERARCHY.indexOf(role);
}

// Permission helper functions

export function canUploadScores(role: Role): boolean {
	return hasPermission(role, 'scores:upload');
}

export function canDeleteScores(role: Role): boolean {
	return hasPermission(role, 'scores:delete');
}

export function canInviteMembers(role: Role): boolean {
	return hasPermission(role, 'members:invite');
}

export function canManageMembers(role: Role): boolean {
	return hasPermission(role, 'members:manage');
}

export function canDeleteVault(role: Role): boolean {
	return hasPermission(role, 'vault:delete');
}
