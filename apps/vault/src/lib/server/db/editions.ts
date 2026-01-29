// Editions database operations
import type {
	Edition,
	EditionType,
	LicenseType,
	CreateEditionInput,
	UpdateEditionInput
} from '$lib/types';

interface EditionRow {
	id: string;
	work_id: string;
	name: string;
	arranger: string | null;
	publisher: string | null;
	voicing: string | null;
	edition_type: string;
	license_type: string;
	notes: string | null;
	external_url: string | null;
	file_key: string | null;
	file_name: string | null;
	file_size: number | null;
	file_uploaded_at: string | null;
	file_uploaded_by: string | null;
	created_at: string;
}

/**
 * Convert database row to Edition interface (snake_case → camelCase)
 */
function rowToEdition(row: EditionRow, sectionIds: string[] = []): Edition {
	return {
		id: row.id,
		workId: row.work_id,
		name: row.name,
		arranger: row.arranger,
		publisher: row.publisher,
		voicing: row.voicing,
		editionType: row.edition_type as EditionType,
		licenseType: row.license_type as LicenseType,
		notes: row.notes,
		externalUrl: row.external_url,
		fileKey: row.file_key,
		fileName: row.file_name,
		fileSize: row.file_size,
		fileUploadedAt: row.file_uploaded_at,
		fileUploadedBy: row.file_uploaded_by,
		createdAt: row.created_at,
		sectionIds
	};
}

/**
 * Generate a unique ID for an edition
 */
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Insert section assignments for an edition
 */
async function insertSectionAssignments(
	db: D1Database,
	editionId: string,
	sectionIds: string[]
): Promise<void> {
	if (sectionIds.length === 0) return;
	const statements = sectionIds.map((sectionId) =>
		db.prepare('INSERT INTO edition_sections (edition_id, section_id) VALUES (?, ?)').bind(editionId, sectionId)
	);
	await db.batch(statements);
}

/**
 * Build Edition object from input (for create response)
 */
function buildEditionFromInput(id: string, input: CreateEditionInput, createdAt: string): Edition {
	return {
		id,
		workId: input.workId,
		name: input.name,
		arranger: input.arranger ?? null,
		publisher: input.publisher ?? null,
		voicing: input.voicing ?? null,
		editionType: input.editionType ?? 'vocal_score',
		licenseType: input.licenseType ?? 'owned',
		notes: input.notes ?? null,
		externalUrl: input.externalUrl ?? null,
		fileKey: null,
		fileName: null,
		fileSize: null,
		fileUploadedAt: null,
		fileUploadedBy: null,
		createdAt,
		sectionIds: input.sectionIds ?? []
	};
}

/**
 * Create a new edition
 */
export async function createEdition(db: D1Database, input: CreateEditionInput): Promise<Edition> {
	const id = generateId();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO editions (
				id, work_id, name, arranger, publisher, voicing,
				edition_type, license_type, notes, external_url, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			id, input.workId, input.name, input.arranger ?? null, input.publisher ?? null,
			input.voicing ?? null, input.editionType ?? 'vocal_score', input.licenseType ?? 'owned',
			input.notes ?? null, input.externalUrl ?? null, now
		)
		.run();

	await insertSectionAssignments(db, id, input.sectionIds ?? []);
	return buildEditionFromInput(id, input, now);
}

/**
 * Get an edition by ID with section assignments
 */
export async function getEditionById(db: D1Database, id: string): Promise<Edition | null> {
	const row = await db
		.prepare(`
			SELECT id, work_id, name, arranger, publisher, voicing,
				edition_type, license_type, notes, external_url,
				file_key, file_name, file_size, file_uploaded_at, file_uploaded_by,
				created_at
			FROM editions WHERE id = ?
		`)
		.bind(id)
		.first<EditionRow>();

	if (!row) {
		return null;
	}

	// Get section assignments
	const sectionsResult = await db
		.prepare('SELECT section_id FROM edition_sections WHERE edition_id = ?')
		.bind(id)
		.all<{ section_id: string }>();

	const sectionIds = sectionsResult.results.map((r) => r.section_id);

	return rowToEdition(row, sectionIds);
}

/**
 * Get all editions for a work
 */
export async function getEditionsByWorkId(db: D1Database, workId: string): Promise<Edition[]> {
	const { results } = await db
		.prepare(`
			SELECT id, work_id, name, arranger, publisher, voicing,
				edition_type, license_type, notes, external_url,
				file_key, file_name, file_size, file_uploaded_at, file_uploaded_by,
				created_at
			FROM editions
			WHERE work_id = ?
			ORDER BY edition_type, name ASC
		`)
		.bind(workId)
		.all<EditionRow>();

	// For list view, we don't load sections (use getEditionById for full details)
	return results.map((row) => rowToEdition(row, []));
}

/** Edition with work info for list display */
export interface EditionWithWork extends Edition {
	workTitle: string;
	workComposer: string | null;
}

interface EditionWithWorkRow extends EditionRow {
	work_title: string;
	work_composer: string | null;
}

/**
 * Get all editions with work info (for global edition list)
 */
export async function getAllEditions(db: D1Database): Promise<EditionWithWork[]> {
	const { results } = await db
		.prepare(`
			SELECT e.id, e.work_id, e.name, e.arranger, e.publisher, e.voicing,
				e.edition_type, e.license_type, e.notes, e.external_url,
				e.file_key, e.file_name, e.file_size, e.file_uploaded_at, e.file_uploaded_by,
				e.created_at,
				w.title as work_title, w.composer as work_composer
			FROM editions e
			JOIN works w ON e.work_id = w.id
			ORDER BY w.title ASC, e.name ASC
		`)
		.all<EditionWithWorkRow>();

	return results.map((row) => ({
		...rowToEdition(row, []),
		workTitle: row.work_title,
		workComposer: row.work_composer
	}));
}

// Field mappings for dynamic updates
const EDITION_FIELD_MAP: Record<string, string> = {
	name: 'name', arranger: 'arranger', publisher: 'publisher', voicing: 'voicing',
	editionType: 'edition_type', licenseType: 'license_type', notes: 'notes', externalUrl: 'external_url'
};

/**
 * Build UPDATE clause from input
 */
function buildUpdateClause(input: UpdateEditionInput): { updates: string[]; values: (string | null)[] } {
	const updates: string[] = [];
	const values: (string | null)[] = [];
	for (const [key, column] of Object.entries(EDITION_FIELD_MAP)) {
		const value = input[key as keyof UpdateEditionInput];
		if (value !== undefined) {
			updates.push(`${column} = ?`);
			values.push(value as string | null);
		}
	}
	return { updates, values };
}

/**
 * Update section assignments for an edition
 */
async function updateSectionAssignments(db: D1Database, editionId: string, sectionIds: string[]): Promise<void> {
	await db.prepare('DELETE FROM edition_sections WHERE edition_id = ?').bind(editionId).run();
	await insertSectionAssignments(db, editionId, sectionIds);
}

/**
 * Update an edition
 */
export async function updateEdition(db: D1Database, id: string, input: UpdateEditionInput): Promise<Edition | null> {
	const { updates, values } = buildUpdateClause(input);

	if (updates.length > 0) {
		values.push(id);
		const result = await db.prepare(`UPDATE editions SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
		if ((result.meta.changes ?? 0) === 0) return null;
	}

	if (input.sectionIds !== undefined) {
		await updateSectionAssignments(db, id, input.sectionIds);
	}

	return getEditionById(db, id);
}

/**
 * Delete an edition
 * Section assignments are deleted via CASCADE
 */
export async function deleteEdition(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM editions WHERE id = ?')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/** File info for updating an edition */
export interface EditionFileInfo {
	fileKey: string;
	fileName: string;
	fileSize: number;
	uploadedBy: string;
}

/**
 * Update file info for an edition (used after file upload)
 */
export async function updateEditionFile(db: D1Database, id: string, fileInfo: EditionFileInfo): Promise<Edition | null> {
	const now = new Date().toISOString();
	const { fileKey, fileName, fileSize, uploadedBy } = fileInfo;

	const result = await db
		.prepare(`UPDATE editions SET file_key = ?, file_name = ?, file_size = ?, file_uploaded_at = ?, file_uploaded_by = ? WHERE id = ?`)
		.bind(fileKey, fileName, fileSize, now, uploadedBy, id)
		.run();

	return (result.meta.changes ?? 0) === 0 ? null : getEditionById(db, id);
}

/**
 * Remove file from an edition
 */
export async function removeEditionFile(db: D1Database, id: string): Promise<Edition | null> {
	const result = await db
		.prepare(`
			UPDATE editions
			SET file_key = NULL, file_name = NULL, file_size = NULL, file_uploaded_at = NULL, file_uploaded_by = NULL
			WHERE id = ?
		`)
		.bind(id)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	return getEditionById(db, id);
}
