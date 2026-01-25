// Auth middleware for route protection
import { getMemberById, type Member } from '$lib/server/db/members';
import { requireRole, type Role } from './permissions';

export interface AuthMiddlewareResult {
	authorized: boolean;
	member?: Member;
	status?: number;
	error?: string;
}

export interface AuthMiddlewareParams {
	db: D1Database;
	memberId: string | null | undefined;
}

/**
 * Get member from cookie/session
 */
export async function getMemberFromCookie(
	db: D1Database,
	memberId: string | null | undefined
): Promise<Member | null> {
	if (!memberId) {
		return null;
	}
	return await getMemberById(db, memberId);
}

/**
 * Create auth middleware for a minimum role requirement
 */
export function createAuthMiddleware(minRole: Role) {
	return async (params: AuthMiddlewareParams): Promise<AuthMiddlewareResult> => {
		const { db, memberId } = params;

		const member = await getMemberFromCookie(db, memberId);

		if (!member) {
			return {
				authorized: false,
				status: 401,
				error: 'Authentication required'
			};
		}

		const roleCheck = requireRole(member, minRole);

		if (!roleCheck.success) {
			return {
				authorized: false,
				status: 403,
				error: roleCheck.error ?? 'Insufficient permissions'
			};
		}

		return {
			authorized: true,
			member
		};
	};
}

/**
 * Pre-built middleware for common role requirements
 */
export const requireSinger = createAuthMiddleware('singer');
export const requireLibrarian = createAuthMiddleware('librarian');
export const requireAdmin = createAuthMiddleware('admin');
export const requireOwner = createAuthMiddleware('owner');
