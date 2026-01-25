// Score database operations

export interface Score {
	id: string;
	title: string;
	composer: string | null;
	arranger: string | null;
	license_type: 'public_domain' | 'licensed' | 'owned' | 'pending';
	file_key: string;
	uploaded_by: string | null;
	uploaded_at: string;
	deleted_at: string | null;
}

export interface CreateScoreInput {
	title: string;
	composer?: string;
	arranger?: string;
	license_type: 'public_domain' | 'licensed' | 'owned' | 'pending';
	file_key: string;
	uploaded_by?: string;
}

// Simple ID generator
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a new score in the database
 */
export async function createScore(
	db: D1Database,
	input: CreateScoreInput
): Promise<Score> {
	const id = generateId();
	const composer = input.composer ?? null;
	const arranger = input.arranger ?? null;
	const uploaded_by = input.uploaded_by ?? null;

	await db
		.prepare(
			'INSERT INTO scores (id, title, composer, arranger, license_type, file_key, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(id, input.title, composer, arranger, input.license_type, input.file_key, uploaded_by)
		.run();

	const score = await getScoreById(db, id);
	if (!score) {
		throw new Error('Failed to create score');
	}
	return score;
}

/**
 * Find a score by ID
 */
export async function getScoreById(
	db: D1Database,
	id: string
): Promise<Score | null> {
	const result = await db
		.prepare('SELECT id, title, composer, arranger, license_type, file_key, uploaded_by, uploaded_at, deleted_at FROM scores WHERE id = ?')
		.bind(id)
		.first<Score>();

	return result ?? null;
}

/**
 * List all non-deleted scores
 */
export async function listScores(db: D1Database): Promise<Score[]> {
	const { results } = await db
		.prepare('SELECT id, title, composer, arranger, license_type, file_key, uploaded_by, uploaded_at, deleted_at FROM scores WHERE deleted_at IS NULL ORDER BY uploaded_at DESC')
		.all<Score>();

	return results;
}

/**
 * Soft delete a score (for takedown requests)
 */
export async function softDeleteScore(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare('UPDATE scores SET deleted_at = datetime(\'now\') WHERE id = ? AND deleted_at IS NULL')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
