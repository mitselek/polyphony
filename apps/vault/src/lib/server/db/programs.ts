// Event programs (setlists) database operations
export interface ProgramEntry {
	event_id: string;
	score_id: string;
	position: number;
	notes: string | null;
	added_at: string;
}

/**
 * Get all scores in an event's program, ordered by position
 */
export async function getEventProgram(db: D1Database, eventId: string): Promise<ProgramEntry[]> {
	const { results } = await db
		.prepare(
			`SELECT event_id, score_id, position, notes, added_at 
			FROM event_programs 
			WHERE event_id = ? 
			ORDER BY position ASC`
		)
		.bind(eventId)
		.all<ProgramEntry>();

	return results;
}

/**
 * Add a score to an event's program
 * @throws Error if score already exists in program (UNIQUE constraint)
 */
export async function addToProgram(
	db: D1Database,
	eventId: string,
	scoreId: string,
	position: number,
	notes?: string
): Promise<boolean> {
	const result = await db
		.prepare(
			'INSERT INTO event_programs (event_id, score_id, position, notes) VALUES (?, ?, ?, ?)'
		)
		.bind(eventId, scoreId, position, notes ?? null)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Remove a score from an event's program
 */
export async function removeFromProgram(
	db: D1Database,
	eventId: string,
	scoreId: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM event_programs WHERE event_id = ? AND score_id = ?')
		.bind(eventId, scoreId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Reorder all scores in an event's program
 * @param scoreIds Array of score IDs in desired order
 */
export async function reorderProgram(
	db: D1Database,
	eventId: string,
	scoreIds: string[]
): Promise<void> {
	// Update position for each score
	const statements = scoreIds.map((scoreId, index) =>
		db
			.prepare('UPDATE event_programs SET position = ? WHERE event_id = ? AND score_id = ?')
			.bind(index, eventId, scoreId)
	);

	await db.batch(statements);
}
