// Takedown database operations for copyright claims

export type TakedownStatus = 'pending' | 'approved' | 'rejected';

export interface TakedownRequest {
	id: string;
	score_id: string;
	claimant_name: string;
	claimant_email: string;
	reason: string;
	attestation: boolean;
	status: TakedownStatus;
	created_at: string;
	processed_at: string | null;
	processed_by: string | null;
	resolution_notes: string | null;
}

export interface CreateTakedownInput {
	score_id: string;
	claimant_name: string;
	claimant_email: string;
	reason: string;
	attestation: boolean;
}

export interface ProcessTakedownInput {
	takedownId: string;
	status: 'approved' | 'rejected';
	processedBy: string;
	notes: string;
}

export interface ProcessTakedownResult {
	success: boolean;
	error?: string;
}

// Simple ID generator
function generateId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Create a new takedown request
 */
export async function createTakedownRequest(
	db: D1Database,
	input: CreateTakedownInput
): Promise<TakedownRequest> {
	// Validation
	if (!input.claimant_name?.trim()) {
		throw new Error('Claimant name is required');
	}

	if (!input.claimant_email?.trim()) {
		throw new Error('Claimant email is required');
	}

	if (!isValidEmail(input.claimant_email)) {
		throw new Error('Invalid email format');
	}

	if (!input.score_id?.trim()) {
		throw new Error('Score ID is required');
	}

	if (!input.reason?.trim()) {
		throw new Error('Reason is required');
	}

	if (!input.attestation) {
		throw new Error('Attestation must be acknowledged');
	}

	const id = generateId();
	const now = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO takedowns (id, score_id, claimant_name, claimant_email, reason, attestation, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
		)
		.bind(
			id,
			input.score_id,
			input.claimant_name.trim(),
			input.claimant_email.trim(),
			input.reason.trim(),
			input.attestation ? 1 : 0,
			now
		)
		.run();

	const takedown = await getTakedownById(db, id);
	if (!takedown) {
		throw new Error('Failed to create takedown request');
	}
	return takedown;
}

/**
 * Get a takedown request by ID
 */
export async function getTakedownById(
	db: D1Database,
	id: string
): Promise<TakedownRequest | null> {
	const result = await db
		.prepare(
			`SELECT id, score_id, claimant_name, claimant_email, reason, attestation, 
			        status, created_at, processed_at, processed_by, resolution_notes
			 FROM takedowns WHERE id = ?`
		)
		.bind(id)
		.first<TakedownRequest>();

	if (result) {
		// Convert attestation from 0/1 to boolean
		result.attestation = Boolean(result.attestation);
	}

	return result ?? null;
}

/**
 * List all takedown requests
 */
export async function listTakedownRequests(
	db: D1Database,
	status?: TakedownStatus
): Promise<TakedownRequest[]> {
	let query = `SELECT id, score_id, claimant_name, claimant_email, reason, attestation, 
	                    status, created_at, processed_at, processed_by, resolution_notes
	             FROM takedowns`;
	
	if (status) {
		query += ` WHERE status = ?`;
	}
	
	query += ` ORDER BY created_at DESC`;

	const stmt = db.prepare(query);
	const result = status 
		? await stmt.bind(status).all<TakedownRequest>()
		: await stmt.all<TakedownRequest>();

	return result.results.map(r => ({
		...r,
		attestation: Boolean(r.attestation)
	}));
}

/**
 * Process a takedown request (approve or reject)
 */
export async function processTakedown(
	db: D1Database,
	input: ProcessTakedownInput
): Promise<ProcessTakedownResult> {
	const takedown = await getTakedownById(db, input.takedownId);

	if (!takedown) {
		return { success: false, error: 'Takedown request not found' };
	}

	if (takedown.status !== 'pending') {
		return { success: false, error: 'Takedown has already been processed' };
	}

	const now = new Date().toISOString();

	// Update takedown status
	await db
		.prepare(
			`UPDATE takedowns SET status = ?, processed_at = ?, processed_by = ?, resolution_notes = ?
			 WHERE id = ?`
		)
		.bind(input.status, now, input.processedBy, input.notes, input.takedownId)
		.run();

	// If approved, soft-delete the score
	if (input.status === 'approved') {
		await db
			.prepare(`UPDATE scores SET deleted_at = ? WHERE id = ?`)
			.bind(now, takedown.score_id)
			.run();
	}

	return { success: true };
}
