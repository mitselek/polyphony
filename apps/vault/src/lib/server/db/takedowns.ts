// Takedown database operations for copyright claims

import { generateId } from '$lib/server/utils/id';

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

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate takedown input fields
 * Throws error if validation fails
 */
function validateCreateInput(input: CreateTakedownInput): void {
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
}

/**
 * Prepare takedown data for insertion
 */
function prepareTakedownData(input: CreateTakedownInput, id: string, now: string) {
	return {
		id,
		score_id: input.score_id.trim(),
		claimant_name: input.claimant_name.trim(),
		claimant_email: input.claimant_email.trim(),
		reason: input.reason.trim(),
		attestation: input.attestation ? 1 : 0,
		status: 'pending' as const,
		created_at: now
	};
}

/**
 * Create a new takedown request
 */
export async function createTakedownRequest(
	db: D1Database,
	input: CreateTakedownInput
): Promise<TakedownRequest> {
	// Validate input
	validateCreateInput(input);

	const id = generateId();
	const now = new Date().toISOString();
	const data = prepareTakedownData(input, id, now);

	await db
		.prepare(
			`INSERT INTO takedowns (id, score_id, claimant_name, claimant_email, reason, attestation, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(data.id, data.score_id, data.claimant_name, data.claimant_email, data.reason, data.attestation, data.status, data.created_at)
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
 * Check if takedown can be processed (must be pending)
 */
function canProcessTakedown(takedown: TakedownRequest | null): { valid: boolean; error?: string } {
	if (!takedown) {
		return { valid: false, error: 'Takedown request not found' };
	}
	if (takedown.status !== 'pending') {
		return { valid: false, error: 'Takedown has already been processed' };
	}
	return { valid: true };
}

/**
 * Update takedown status and metadata
 */
async function updateTakedownStatus(
	db: D1Database,
	takedownId: string,
	status: 'approved' | 'rejected',
	processedBy: string,
	notes: string
): Promise<void> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`UPDATE takedowns SET status = ?, processed_at = ?, processed_by = ?, resolution_notes = ?
			 WHERE id = ?`
		)
		.bind(status, now, processedBy, notes, takedownId)
		.run();
}

/**
 * Soft-delete score if takedown approved
 */
async function softDeleteApprovedScore(db: D1Database, scoreId: string): Promise<void> {
	const now = new Date().toISOString();
	await db.prepare(`UPDATE scores SET deleted_at = ? WHERE id = ?`).bind(now, scoreId).run();
}

/**
 * Process a takedown request (approve or reject)
 */
export async function processTakedown(
	db: D1Database,
	input: ProcessTakedownInput
): Promise<ProcessTakedownResult> {
	const takedown = await getTakedownById(db, input.takedownId);
	const validation = canProcessTakedown(takedown);

	if (!validation.valid) {
		return { success: false, error: validation.error };
	}

	await updateTakedownStatus(db, input.takedownId, input.status, input.processedBy, input.notes);

	if (input.status === 'approved') {
		await softDeleteApprovedScore(db, takedown!.score_id);
	}

	return { success: true };
}
