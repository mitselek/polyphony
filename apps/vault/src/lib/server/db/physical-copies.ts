// Physical copies database operations
// Part of Epic #106 - Phase B: Physical Inventory

export type CopyCondition = 'good' | 'fair' | 'poor' | 'lost';

export interface PhysicalCopy {
	id: string;
	editionId: string;
	copyNumber: string;
	condition: CopyCondition;
	acquiredAt: string | null;
	notes: string | null;
	createdAt: string;
}

export interface CreatePhysicalCopyInput {
	editionId: string;
	copyNumber: string;
	condition?: CopyCondition;
	acquiredAt?: string;
	notes?: string;
}

export interface BatchCreateInput {
	editionId: string;
	count: number;
	prefix?: string; // e.g., "M" → "M-01", "M-02", ...
	startNumber?: number; // Default 1
	condition?: CopyCondition;
	acquiredAt?: string;
}

export interface UpdatePhysicalCopyInput {
	condition?: CopyCondition;
	notes?: string | null;
	acquiredAt?: string | null;
}

interface PhysicalCopyRow {
	id: string;
	edition_id: string;
	copy_number: string;
	condition: string;
	acquired_at: string | null;
	notes: string | null;
	created_at: string;
}

/**
 * Convert database row to PhysicalCopy interface
 */
function rowToCopy(row: PhysicalCopyRow): PhysicalCopy {
	return {
		id: row.id,
		editionId: row.edition_id,
		copyNumber: row.copy_number,
		condition: row.condition as CopyCondition,
		acquiredAt: row.acquired_at,
		notes: row.notes,
		createdAt: row.created_at
	};
}

/**
 * Generate a unique ID
 */
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Create a single physical copy
 */
export async function createPhysicalCopy(
	db: D1Database,
	input: CreatePhysicalCopyInput
): Promise<PhysicalCopy> {
	const id = generateId();
	const condition = input.condition ?? 'good';
	const acquiredAt = input.acquiredAt ?? null;
	const notes = input.notes ?? null;

	await db
		.prepare(
			`INSERT INTO physical_copies (id, edition_id, copy_number, condition, acquired_at, notes)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(id, input.editionId, input.copyNumber, condition, acquiredAt, notes)
		.run();

	const copy = await getPhysicalCopyById(db, id);
	if (!copy) {
		throw new Error('Failed to create physical copy');
	}
	return copy;
}

/**
 * Generate copy number entries for batch creation
 */
function generateCopyNumbers(
	startNumber: number,
	count: number,
	prefix: string
): { id: string; copyNumber: string }[] {
	const maxNumber = startNumber + count - 1;
	const padWidth = String(maxNumber).length;

	return Array.from({ length: count }, (_, i) => {
		const num = startNumber + i;
		const paddedNum = String(num).padStart(padWidth, '0');
		const copyNumber = prefix ? `${prefix}-${paddedNum}` : paddedNum;
		return { id: generateId(), copyNumber };
	});
}

/**
 * Create multiple physical copies with auto-generated numbers
 * Numbers are zero-padded based on total count (e.g., 01-99 for count < 100)
 * If startNumber is not specified, automatically finds the next available number
 */
export async function batchCreatePhysicalCopies(
	db: D1Database,
	input: BatchCreateInput
): Promise<PhysicalCopy[]> {
	const { editionId, count, prefix = '', condition = 'good', acquiredAt } = input;

	if (count <= 0) {
		throw new Error('Count must be positive');
	}

	const startNumber = input.startNumber ?? await getNextAvailableCopyNumber(db, editionId, prefix);
	const copies = generateCopyNumbers(startNumber, count, prefix);

	// Batch insert
	const statements = copies.map((copy) =>
		db
			.prepare(
				`INSERT INTO physical_copies (id, edition_id, copy_number, condition, acquired_at)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(copy.id, editionId, copy.copyNumber, condition, acquiredAt ?? null)
	);

	await db.batch(statements);

	return getPhysicalCopiesByEdition(db, editionId);
}

/**
 * Find the next available copy number for an edition
 * Parses existing copy numbers to find the highest and returns highest + 1
 */
async function getNextAvailableCopyNumber(
	db: D1Database,
	editionId: string,
	prefix: string
): Promise<number> {
	// Get all existing copy numbers for this edition
	const { results } = await db
		.prepare('SELECT copy_number FROM physical_copies WHERE edition_id = ?')
		.bind(editionId)
		.all<{ copy_number: string }>();

	if (!results || results.length === 0) {
		return 1;
	}

	// Find the highest number
	let maxNum = 0;
	for (const row of results) {
		const copyNumber = row.copy_number;
		// Try to extract the numeric part
		let numStr: string;
		if (prefix && copyNumber.startsWith(`${prefix}-`)) {
			numStr = copyNumber.slice(prefix.length + 1);
		} else if (!prefix) {
			numStr = copyNumber;
		} else {
			// Different prefix, skip
			continue;
		}
		
		const num = parseInt(numStr, 10);
		if (!isNaN(num) && num > maxNum) {
			maxNum = num;
		}
	}

	return maxNum + 1;
}

/**
 * Get a physical copy by ID
 */
export async function getPhysicalCopyById(
	db: D1Database,
	id: string
): Promise<PhysicalCopy | null> {
	const row = await db
		.prepare('SELECT * FROM physical_copies WHERE id = ?')
		.bind(id)
		.first<PhysicalCopyRow>();

	return row ? rowToCopy(row) : null;
}

/**
 * Get all physical copies for an edition
 */
export async function getPhysicalCopiesByEdition(
	db: D1Database,
	editionId: string
): Promise<PhysicalCopy[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM physical_copies 
			 WHERE edition_id = ? 
			 ORDER BY copy_number COLLATE NOCASE`
		)
		.bind(editionId)
		.all<PhysicalCopyRow>();

	return results.map(rowToCopy);
}

interface UpdateQuery {
	updates: string[];
	values: (string | null)[];
}

function buildUpdateQuery(input: UpdatePhysicalCopyInput): UpdateQuery {
	const updates: string[] = [];
	const values: (string | null)[] = [];

	if (input.condition !== undefined) {
		updates.push('condition = ?');
		values.push(input.condition);
	}
	if (input.notes !== undefined) {
		updates.push('notes = ?');
		values.push(input.notes);
	}
	if (input.acquiredAt !== undefined) {
		updates.push('acquired_at = ?');
		values.push(input.acquiredAt);
	}
	return { updates, values };
}

/**
 * Update a physical copy (condition, notes, acquired_at)
 */
export async function updatePhysicalCopy(
	db: D1Database,
	id: string,
	input: UpdatePhysicalCopyInput
): Promise<PhysicalCopy | null> {
	const { updates, values } = buildUpdateQuery(input);
	if (updates.length === 0) return getPhysicalCopyById(db, id);

	values.push(id);
	await db
		.prepare(`UPDATE physical_copies SET ${updates.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	return getPhysicalCopyById(db, id);
}

/**
 * Delete a physical copy
 */
export async function deletePhysicalCopy(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM physical_copies WHERE id = ?')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Check if a copy number already exists for an edition
 */
export async function copyNumberExists(
	db: D1Database,
	editionId: string,
	copyNumber: string
): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 FROM physical_copies WHERE edition_id = ? AND copy_number = ?')
		.bind(editionId, copyNumber)
		.first();

	return row !== null;
}

/**
 * Get copy counts by condition for an edition
 */
export async function getCopyStats(
	db: D1Database,
	editionId: string
): Promise<{ total: number; good: number; fair: number; poor: number; lost: number }> {
	const { results } = await db
		.prepare(
			`SELECT condition, COUNT(*) as count 
			 FROM physical_copies 
			 WHERE edition_id = ? 
			 GROUP BY condition`
		)
		.bind(editionId)
		.all<{ condition: string; count: number }>();

	const stats = { total: 0, good: 0, fair: 0, poor: 0, lost: 0 };

	for (const row of results) {
		const count = row.count;
		stats.total += count;
		if (row.condition in stats) {
			stats[row.condition as keyof typeof stats] = count;
		}
	}

	return stats;
}
