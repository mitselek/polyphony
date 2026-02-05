/**
 * Shared ID generation utility
 * Consistent implementation across all database modules
 */

/**
 * Generate a unique ID for database records
 * @param prefix Optional prefix for namespaced IDs (e.g., 'org_', 'invite_')
 * @returns A 21-character alphanumeric ID, optionally prefixed
 */
export function generateId(prefix?: string): string {
	const id = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
	return prefix ? `${prefix}${id.slice(0, 16)}` : id;
}
