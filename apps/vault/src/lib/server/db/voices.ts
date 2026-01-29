// Voices database operations
import type { Voice, CreateVoiceInput } from '$lib/types';

interface VoiceRow {
	id: string;
	name: string;
	abbreviation: string;
	category: 'vocal' | 'instrumental';
	range_group: string | null;
	display_order: number;
	is_active: number;
}

interface VoiceWithCountRow extends VoiceRow {
	assignment_count: number;
}

/** Voice with assignment count for management UI */
export interface VoiceWithCount extends Voice {
	assignmentCount: number;
}

/**
 * Convert database row to Voice interface (snake_case → camelCase)
 */
function rowToVoice(row: VoiceRow): Voice {
	return {
		id: row.id,
		name: row.name,
		abbreviation: row.abbreviation,
		category: row.category,
		rangeGroup: row.range_group,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	};
}

/**
 * Convert database row to VoiceWithCount
 */
function rowToVoiceWithCount(row: VoiceWithCountRow): VoiceWithCount {
	return {
		...rowToVoice(row),
		assignmentCount: row.assignment_count
	};
}

/**
 * Get all active voices ordered by display_order
 */
export async function getActiveVoices(db: D1Database): Promise<Voice[]> {
	const { results } = await db
		.prepare('SELECT * FROM voices WHERE is_active = 1 ORDER BY display_order ASC')
		.all<VoiceRow>();

	return results.map(rowToVoice);
}

/**
 * Get all voices (including inactive) ordered by display_order
 */
export async function getAllVoices(db: D1Database): Promise<Voice[]> {
	const { results } = await db
		.prepare('SELECT * FROM voices ORDER BY display_order ASC')
		.all<VoiceRow>();

	return results.map(rowToVoice);
}

/**
 * Get voice by id
 */
export async function getVoiceById(db: D1Database, id: string): Promise<Voice | null> {
	const row = await db
		.prepare('SELECT * FROM voices WHERE id = ?')
		.bind(id)
		.first<VoiceRow>();

	return row ? rowToVoice(row) : null;
}

/**
 * Create a new voice
 */
export async function createVoice(db: D1Database, input: CreateVoiceInput): Promise<Voice> {
	// Generate id from name (lowercase, replace spaces with hyphens)
	const id = input.name.toLowerCase().replace(/\s+/g, '-');
	const isActive = input.isActive ?? true;

	await db
		.prepare(
			'INSERT INTO voices (id, name, abbreviation, category, range_group, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id,
			input.name,
			input.abbreviation,
			input.category,
			input.rangeGroup ?? null,
			input.displayOrder,
			isActive ? 1 : 0
		)
		.run();

	return {
		id,
		name: input.name,
		abbreviation: input.abbreviation,
		category: input.category,
		rangeGroup: input.rangeGroup ?? null,
		displayOrder: input.displayOrder,
		isActive
	};
}

/**
 * Toggle voice active status
 * @returns true if voice was updated, false if voice not found
 */
export async function toggleVoiceActive(
	db: D1Database,
	id: string,
	isActive: boolean
): Promise<boolean> {
	const result = await db
		.prepare('UPDATE voices SET is_active = ? WHERE id = ?')
		.bind(isActive ? 1 : 0, id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Get all voices with assignment counts (member + invite assignments)
 */
export async function getAllVoicesWithCounts(db: D1Database): Promise<VoiceWithCount[]> {
	const { results } = await db
		.prepare(`
			SELECT v.*, 
				(SELECT COUNT(*) FROM member_voices mv WHERE mv.voice_id = v.id) +
				(SELECT COUNT(*) FROM invite_voices iv WHERE iv.voice_id = v.id) AS assignment_count
			FROM voices v
			ORDER BY v.display_order ASC
		`)
		.all<VoiceWithCountRow>();

	return results.map(rowToVoiceWithCount);
}

/**
 * Get assignment count for a specific voice
 */
export async function getVoiceAssignmentCount(db: D1Database, id: string): Promise<number> {
	const result = await db
		.prepare(`
			SELECT 
				(SELECT COUNT(*) FROM member_voices WHERE voice_id = ?) +
				(SELECT COUNT(*) FROM invite_voices WHERE voice_id = ?) AS count
		`)
		.bind(id, id)
		.first<{ count: number }>();

	return result?.count ?? 0;
}

/**
 * Reassign all voice assignments from source to target
 * Skips duplicates (member/invite already has target voice)
 * Preserves is_primary flag
 * @returns number of assignments moved
 */
export async function reassignVoice(
	db: D1Database,
	sourceId: string,
	targetId: string
): Promise<number> {
	if (sourceId === targetId) {
		throw new Error('Cannot reassign voice to itself');
	}

	// Check target exists
	const target = await getVoiceById(db, targetId);
	if (!target) {
		throw new Error('Target voice not found');
	}

	let movedCount = 0;

	// Move member_voices (skip duplicates)
	const memberResult = await db
		.prepare(`
			UPDATE member_voices 
			SET voice_id = ?
			WHERE voice_id = ?
			AND member_id NOT IN (
				SELECT member_id FROM member_voices WHERE voice_id = ?
			)
		`)
		.bind(targetId, sourceId, targetId)
		.run();
	movedCount += memberResult.meta.changes ?? 0;

	// Delete remaining duplicates from source
	await db
		.prepare('DELETE FROM member_voices WHERE voice_id = ?')
		.bind(sourceId)
		.run();

	// Move invite_voices (skip duplicates)
	const inviteResult = await db
		.prepare(`
			UPDATE invite_voices 
			SET voice_id = ?
			WHERE voice_id = ?
			AND invite_id NOT IN (
				SELECT invite_id FROM invite_voices WHERE voice_id = ?
			)
		`)
		.bind(targetId, sourceId, targetId)
		.run();
	movedCount += inviteResult.meta.changes ?? 0;

	// Delete remaining duplicates from source
	await db
		.prepare('DELETE FROM invite_voices WHERE voice_id = ?')
		.bind(sourceId)
		.run();

	return movedCount;
}

/**
 * Delete a voice (only if no assignments exist)
 * @returns true if deleted, false if not found
 * @throws Error if voice has assignments
 */
export async function deleteVoice(db: D1Database, id: string): Promise<boolean> {
	const count = await getVoiceAssignmentCount(db, id);
	if (count > 0) {
		throw new Error(`Cannot delete voice with ${count} assignments. Reassign first.`);
	}

	const result = await db
		.prepare('DELETE FROM voices WHERE id = ?')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
