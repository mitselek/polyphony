// Event programs (setlists) database operations
export interface ProgramEntry {
	event_id: string;
	edition_id: string;
	position: number;
	notes: string | null;
	added_at: string;
}

/**
 * Get all editions in an event's program, ordered by position
 */
export async function getEventProgram(db: D1Database, eventId: string): Promise<ProgramEntry[]> {
	const { results } = await db
		.prepare(
			`SELECT event_id, edition_id, position, notes, added_at 
			FROM event_programs 
			WHERE event_id = ? 
			ORDER BY position ASC`
		)
		.bind(eventId)
		.all<ProgramEntry>();

	return results;
}

/**
 * Add an edition to an event's program
 * @throws Error if edition already exists in program (UNIQUE constraint)
 */
export async function addToProgram(
	db: D1Database,
	eventId: string,
	editionId: string,
	position: number,
	notes?: string
): Promise<boolean> {
	const result = await db
		.prepare(
			'INSERT INTO event_programs (event_id, edition_id, position, notes) VALUES (?, ?, ?, ?)'
		)
		.bind(eventId, editionId, position, notes ?? null)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Remove an edition from an event's program
 */
export async function removeFromProgram(
	db: D1Database,
	eventId: string,
	editionId: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM event_programs WHERE event_id = ? AND edition_id = ?')
		.bind(eventId, editionId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Reorder all editions in an event's program
 * @param editionIds Array of edition IDs in desired order
 */
export async function reorderProgram(
	db: D1Database,
	eventId: string,
	editionIds: string[]
): Promise<void> {
	// Update position for each edition
	const statements = editionIds.map((editionId, index) =>
		db
			.prepare('UPDATE event_programs SET position = ? WHERE event_id = ? AND edition_id = ?')
			.bind(index, eventId, editionId)
	);

	await db.batch(statements);
}
