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
