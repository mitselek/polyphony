// Copy assignments database operations
// Issue #116 - Copy Assignment/Return workflow
// Part of Epic #106 - Phase B: Physical Inventory

export interface CopyAssignment {
	id: string;
	copyId: string;
	memberId: string;
	assignedAt: string;
	assignedBy: string | null;
	returnedAt: string | null;
	notes: string | null;
}

export interface AssignCopyInput {
	copyId: string;
	memberId: string;
	assignedBy: string;
	notes?: string;
}

export interface GetMemberAssignmentsOptions {
	includeReturned?: boolean;
}

interface CopyAssignmentRow {
	id: string;
	copy_id: string;
	member_id: string;
	assigned_at: string;
	assigned_by: string | null;
	returned_at: string | null;
	notes: string | null;
}

/**
 * Convert database row to CopyAssignment interface
 */
function rowToAssignment(row: CopyAssignmentRow): CopyAssignment {
	return {
		id: row.id,
		copyId: row.copy_id,
		memberId: row.member_id,
		assignedAt: row.assigned_at,
		assignedBy: row.assigned_by,
		returnedAt: row.returned_at,
		notes: row.notes
	};
}

/**
 * Generate a unique ID
 */
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Check if a copy is currently assigned (has active assignment)
 */
export async function isAssigned(db: D1Database, copyId: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT id FROM copy_assignments WHERE copy_id = ? AND returned_at IS NULL')
		.bind(copyId)
		.first();
	return row !== null;
}

/**
 * Assign a copy to a member
 * @throws Error if copy is already assigned
 */
export async function assignCopy(
	db: D1Database,
	input: AssignCopyInput
): Promise<CopyAssignment> {
	// Check if already assigned
	const alreadyAssigned = await isAssigned(db, input.copyId);
	if (alreadyAssigned) {
		throw new Error('Copy is already assigned');
	}

	const id = generateId();
	const notes = input.notes ?? null;

	await db
		.prepare(
			`INSERT INTO copy_assignments (id, copy_id, member_id, assigned_by, notes)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(id, input.copyId, input.memberId, input.assignedBy, notes)
		.run();

	const row = await db
		.prepare('SELECT * FROM copy_assignments WHERE id = ?')
		.bind(id)
		.first<CopyAssignmentRow>();

	if (!row) {
		throw new Error('Failed to create assignment');
	}

	return rowToAssignment(row);
}

/**
 * Mark an assignment as returned
 * @returns The updated assignment, or null if not found
 */
export async function returnCopy(
	db: D1Database,
	assignmentId: string
): Promise<CopyAssignment | null> {
	const result = await db
		.prepare(
			`UPDATE copy_assignments SET returned_at = datetime('now') 
			 WHERE id = ? AND returned_at IS NULL`
		)
		.bind(assignmentId)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	const row = await db
		.prepare('SELECT * FROM copy_assignments WHERE id = ?')
		.bind(assignmentId)
		.first<CopyAssignmentRow>();

	return row ? rowToAssignment(row) : null;
}

/**
 * Get active (non-returned) assignments for a copy
 */
export async function getActiveAssignments(
	db: D1Database,
	copyId: string
): Promise<CopyAssignment[]> {
	const { results } = await db
		.prepare(
			'SELECT * FROM copy_assignments WHERE copy_id = ? AND returned_at IS NULL ORDER BY assigned_at DESC'
		)
		.bind(copyId)
		.all<CopyAssignmentRow>();

	return results.map(rowToAssignment);
}

/**
 * Get full assignment history for a copy (including returned)
 */
export async function getAssignmentHistory(
	db: D1Database,
	copyId: string
): Promise<CopyAssignment[]> {
	const { results } = await db
		.prepare('SELECT * FROM copy_assignments WHERE copy_id = ? ORDER BY assigned_at DESC')
		.bind(copyId)
		.all<CopyAssignmentRow>();

	return results.map(rowToAssignment);
}

/**
 * Get all assignments for a member
 * @param options.includeReturned - Include returned assignments (default: false)
 */
export async function getMemberAssignments(
	db: D1Database,
	memberId: string,
	options: GetMemberAssignmentsOptions = {}
): Promise<CopyAssignment[]> {
	const includeReturned = options.includeReturned ?? false;

	const query = includeReturned
		? 'SELECT * FROM copy_assignments WHERE member_id = ? ORDER BY assigned_at DESC'
		: 'SELECT * FROM copy_assignments WHERE member_id = ? AND returned_at IS NULL ORDER BY assigned_at DESC';

	const { results } = await db.prepare(query).bind(memberId).all<CopyAssignmentRow>();

	return results.map(rowToAssignment);
}

/**
 * Get a single assignment by ID
 */
export async function getAssignmentById(
	db: D1Database,
	id: string
): Promise<CopyAssignment | null> {
	const row = await db
		.prepare('SELECT * FROM copy_assignments WHERE id = ?')
		.bind(id)
		.first<CopyAssignmentRow>();

	return row ? rowToAssignment(row) : null;
}
