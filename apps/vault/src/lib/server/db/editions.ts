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
 * Create a new edition
 */
export async function createEdition(
	db: D1Database,
	input: CreateEditionInput
): Promise<Edition> {
	const id = generateId();
	const now = new Date().toISOString();
	const editionType = input.editionType ?? 'vocal_score';
	const licenseType = input.licenseType ?? 'owned';

	await db
		.prepare(`
			INSERT INTO editions (
				id, work_id, name, arranger, publisher, voicing,
				edition_type, license_type, notes, external_url, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			id,
			input.workId,
			input.name,
			input.arranger ?? null,
			input.publisher ?? null,
			input.voicing ?? null,
			editionType,
			licenseType,
			input.notes ?? null,
			input.externalUrl ?? null,
			now
		)
		.run();

	// Insert section assignments if provided
	if (input.sectionIds && input.sectionIds.length > 0) {
		const sectionStatements = input.sectionIds.map((sectionId) =>
			db
				.prepare('INSERT INTO edition_sections (edition_id, section_id) VALUES (?, ?)')
				.bind(id, sectionId)
		);
		await db.batch(sectionStatements);
	}

	return {
		id,
		workId: input.workId,
		name: input.name,
		arranger: input.arranger ?? null,
		publisher: input.publisher ?? null,
		voicing: input.voicing ?? null,
		editionType,
		licenseType,
		notes: input.notes ?? null,
		externalUrl: input.externalUrl ?? null,
		fileKey: null,
		fileName: null,
		fileSize: null,
		fileUploadedAt: null,
		fileUploadedBy: null,
		createdAt: now,
		sectionIds: input.sectionIds ?? []
	};
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

/**
 * Update an edition
 */
export async function updateEdition(
	db: D1Database,
	id: string,
	input: UpdateEditionInput
): Promise<Edition | null> {
	// Build SET clause dynamically
	const updates: string[] = [];
	const values: (string | number | null)[] = [];

	if (input.name !== undefined) {
		updates.push('name = ?');
		values.push(input.name);
	}
	if (input.arranger !== undefined) {
		updates.push('arranger = ?');
		values.push(input.arranger);
	}
	if (input.publisher !== undefined) {
		updates.push('publisher = ?');
		values.push(input.publisher);
	}
	if (input.voicing !== undefined) {
		updates.push('voicing = ?');
		values.push(input.voicing);
	}
	if (input.editionType !== undefined) {
		updates.push('edition_type = ?');
		values.push(input.editionType);
	}
	if (input.licenseType !== undefined) {
		updates.push('license_type = ?');
		values.push(input.licenseType);
	}
	if (input.notes !== undefined) {
		updates.push('notes = ?');
		values.push(input.notes);
	}
	if (input.externalUrl !== undefined) {
		updates.push('external_url = ?');
		values.push(input.externalUrl);
	}

	if (updates.length > 0) {
		values.push(id);
		const result = await db
			.prepare(`UPDATE editions SET ${updates.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		if ((result.meta.changes ?? 0) === 0) {
			return null;
		}
	}

	// Update section assignments if provided
	if (input.sectionIds !== undefined) {
		// Delete existing assignments
		await db
			.prepare('DELETE FROM edition_sections WHERE edition_id = ?')
			.bind(id)
			.run();

		// Insert new assignments
		if (input.sectionIds.length > 0) {
			const sectionStatements = input.sectionIds.map((sectionId) =>
				db
					.prepare('INSERT INTO edition_sections (edition_id, section_id) VALUES (?, ?)')
					.bind(id, sectionId)
			);
			await db.batch(sectionStatements);
		}
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

/**
 * Update file info for an edition (used after file upload)
 */
export async function updateEditionFile(
	db: D1Database,
	id: string,
	fileKey: string,
	fileName: string,
	fileSize: number,
	uploadedBy: string
): Promise<Edition | null> {
	const now = new Date().toISOString();

	const result = await db
		.prepare(`
			UPDATE editions
			SET file_key = ?, file_name = ?, file_size = ?, file_uploaded_at = ?, file_uploaded_by = ?
			WHERE id = ?
		`)
		.bind(fileKey, fileName, fileSize, now, uploadedBy, id)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	return getEditionById(db, id);
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
