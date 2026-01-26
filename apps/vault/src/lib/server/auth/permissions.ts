// Permission system for role-based access control

export type Role = 'owner' | 'admin' | 'librarian' | 'conductor';

export type Permission =
	| 'scores:view'
	| 'scores:download'
	| 'scores:upload'
	| 'scores:delete'
	| 'members:invite'
	| 'members:manage'
	| 'roles:manage'
	| 'vault:delete'
	| 'events:create'
	| 'events:manage'
	| 'events:delete'
	| 'attendance:record';

export interface Member {
	id: string;
	roles: Role[]; // Multi-role support
	email: string;
}

export interface RequireRoleResult {
	success: boolean;
	error?: string;
}

/**
 * Permission matrix - which roles have which permissions
 * Note: All authenticated members have implicit 'scores:view' and 'scores:download' permissions
 */
const PERMISSIONS: Record<Role, Permission[]> = {
	librarian: ['scores:upload', 'scores:delete'],
	admin: ['members:invite', 'roles:manage'],
	conductor: ['events:create', 'events:manage', 'events:delete', 'attendance:record'],
	owner: ['vault:delete'] // Owner gets all permissions
};

/**
 * Check if a member has a specific permission
 * Permissions are union of all assigned roles
 */
export function hasPermission(member: Member | null | undefined, permission: Permission): boolean {
	if (!member) {
		return false;
	}

	// All authenticated members can view and download scores
	if (permission === 'scores:view' || permission === 'scores:download') {
		return true;
	}

	// Owner has all permissions
	if (member.roles.includes('owner')) {
		return true;
	}

	// Check if any of member's roles grant the permission
	return member.roles.some((role) => PERMISSIONS[role]?.includes(permission) ?? false);
}

/**
 * Check if a member has a specific role
 */
export function hasRole(member: Member | null | undefined, role: Role): boolean {
	return member?.roles.includes(role) ?? false;
}

/**
 * Check if a member has at least one of the required roles
 * Owner role grants access to all role requirements
 */
export function requireRole(
	member: Member | null | undefined,
	requiredRoles: Role | Role[]
): RequireRoleResult {
	if (!member) {
		return { success: false, error: 'Authentication required' };
	}

	// Owner has all permissions
	if (member.roles.includes('owner')) {
		return { success: true };
	}

	const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
	const hasRequiredRole = rolesArray.some((role) => member.roles.includes(role));

	if (!hasRequiredRole) {
		return { success: false, error: 'Insufficient permissions' };
	}

	return { success: true };
}

// Permission helper functions

export function canUploadScores(member: Member | null | undefined): boolean {
	return hasPermission(member, 'scores:upload');
}

export function canDeleteScores(member: Member | null | undefined): boolean {
	return hasPermission(member, 'scores:delete');
}

export function canInviteMembers(member: Member | null | undefined): boolean {
	return hasPermission(member, 'members:invite');
}

export function canManageRoles(member: Member | null | undefined): boolean {
	return hasPermission(member, 'roles:manage');
}

export function canDeleteVault(member: Member | null | undefined): boolean {
	return hasPermission(member, 'vault:delete');
}

export function canCreateEvents(member: Member | null | undefined): boolean {
	return hasPermission(member, 'events:create');
}

export function canManageEvents(member: Member | null | undefined): boolean {
	return hasPermission(member, 'events:manage');
}

export function canDeleteEvents(member: Member | null | undefined): boolean {
	return hasPermission(member, 'events:delete');
}

export function canRecordAttendance(member: Member | null | undefined): boolean {
	return hasPermission(member, 'attendance:record');
}
