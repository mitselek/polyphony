// Sections database operations
import type { Section, CreateSectionInput } from '$lib/types';

interface SectionRow {
	id: string;
	name: string;
	abbreviation: string;
	parent_section_id: string | null;
	display_order: number;
	is_active: number;
}

/**
 * Convert database row to Section interface (snake_case → camelCase)
 */
function rowToSection(row: SectionRow): Section {
	return {
		id: row.id,
		name: row.name,
		abbreviation: row.abbreviation,
		parentSectionId: row.parent_section_id,
		displayOrder: row.display_order,
		isActive: row.is_active === 1
	};
}

/**
 * Get all active sections ordered by display_order
 */
export async function getActiveSections(db: D1Database): Promise<Section[]> {
	const { results } = await db
		.prepare('SELECT * FROM sections WHERE is_active = 1 ORDER BY display_order ASC')
		.all<SectionRow>();

	return results.map(rowToSection);
}

/**
 * Get all sections (including inactive) ordered by display_order
 */
export async function getAllSections(db: D1Database): Promise<Section[]> {
	const { results } = await db
		.prepare('SELECT * FROM sections ORDER BY display_order ASC')
		.all<SectionRow>();

	return results.map(rowToSection);
}

/**
 * Get section by id
 */
export async function getSectionById(db: D1Database, id: string): Promise<Section | null> {
	const row = await db
		.prepare('SELECT * FROM sections WHERE id = ?')
		.bind(id)
		.first<SectionRow>();

	return row ? rowToSection(row) : null;
}

/**
 * Create a new section
 */
export async function createSection(db: D1Database, input: CreateSectionInput): Promise<Section> {
	// Generate id from name (lowercase, replace spaces with hyphens)
	const id = input.name.toLowerCase().replace(/\s+/g, '-');
	const isActive = input.isActive ?? true;

	await db
		.prepare(
			'INSERT INTO sections (id, name, abbreviation, parent_section_id, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id,
			input.name,
			input.abbreviation,
			input.parentSectionId ?? null,
			input.displayOrder,
			isActive ? 1 : 0
		)
		.run();

	return {
		id,
		name: input.name,
		abbreviation: input.abbreviation,
		parentSectionId: input.parentSectionId ?? null,
		displayOrder: input.displayOrder,
		isActive
	};
}

/**
 * Toggle section active status
 * @returns true if section was updated, false if section not found
 */
export async function toggleSectionActive(
	db: D1Database,
	id: string,
	isActive: boolean
): Promise<boolean> {
	const result = await db
		.prepare('UPDATE sections SET is_active = ? WHERE id = ?')
		.bind(isActive ? 1 : 0, id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
