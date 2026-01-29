// Works database operations
import type { Work, CreateWorkInput, UpdateWorkInput } from '$lib/types';

interface WorkRow {
	id: string;
	title: string;
	composer: string | null;
	lyricist: string | null;
	created_at: string;
}

/**
 * Convert database row to Work interface (snake_case → camelCase)
 */
function rowToWork(row: WorkRow): Work {
	return {
		id: row.id,
		title: row.title,
		composer: row.composer,
		lyricist: row.lyricist,
		createdAt: row.created_at
	};
}

/**
 * Generate a unique ID for a work
 */
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new work
 */
export async function createWork(db: D1Database, input: CreateWorkInput): Promise<Work> {
	const id = generateId();
	const now = new Date().toISOString();
	const composer = input.composer ?? null;
	const lyricist = input.lyricist ?? null;

	await db
		.prepare('INSERT INTO works (id, title, composer, lyricist, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(id, input.title, composer, lyricist, now)
		.run();

	return {
		id,
		title: input.title,
		composer,
		lyricist,
		createdAt: now
	};
}

/**
 * Get a work by ID
 */
export async function getWorkById(db: D1Database, id: string): Promise<Work | null> {
	const row = await db
		.prepare('SELECT id, title, composer, lyricist, created_at FROM works WHERE id = ?')
		.bind(id)
		.first<WorkRow>();

	return row ? rowToWork(row) : null;
}

/**
 * Get all works ordered by title
 */
export async function getAllWorks(db: D1Database): Promise<Work[]> {
	const { results } = await db
		.prepare('SELECT id, title, composer, lyricist, created_at FROM works ORDER BY title ASC')
		.all<WorkRow>();

	return results.map(rowToWork);
}

/**
 * Update a work
 * Returns the updated work, or null if not found
 */
export async function updateWork(
	db: D1Database,
	id: string,
	input: UpdateWorkInput
): Promise<Work | null> {
	// Build SET clause dynamically based on provided fields
	const updates: string[] = [];
	const values: (string | null)[] = [];

	if (input.title !== undefined) {
		updates.push('title = ?');
		values.push(input.title);
	}
	if (input.composer !== undefined) {
		updates.push('composer = ?');
		values.push(input.composer);
	}
	if (input.lyricist !== undefined) {
		updates.push('lyricist = ?');
		values.push(input.lyricist);
	}

	if (updates.length === 0) {
		// No updates, just return current state
		return getWorkById(db, id);
	}

	values.push(id);

	const result = await db
		.prepare(`UPDATE works SET ${updates.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	return getWorkById(db, id);
}

/**
 * Delete a work
 * Returns true if deleted, false if not found
 */
export async function deleteWork(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM works WHERE id = ?')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Search works by title or composer (case-insensitive)
 */
export async function searchWorks(db: D1Database, query: string): Promise<Work[]> {
	const pattern = `%${query}%`;

	const { results } = await db
		.prepare(`
			SELECT id, title, composer, lyricist, created_at 
			FROM works 
			WHERE title LIKE ? OR composer LIKE ?
			ORDER BY title ASC
		`)
		.bind(pattern, pattern)
		.all<WorkRow>();

	return results.map(rowToWork);
}
