// Auth code generation and verification
// Issue #156 - Email Authentication

const CODE_LENGTH = 6;
// Exclude confusing characters: 0/O, 1/I/L
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_EXPIRY_MINUTES = 10;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_HOURS = 1;

/**
 * Generate a random 6-character verification code
 * Uses characters that are easy to read and type
 */
export function generateCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	return Array.from(bytes)
		.map((b) => CODE_CHARS[b % CODE_CHARS.length])
		.join('');
}

export interface CreateCodeResult {
	success: boolean;
	code?: string;
	error?: string;
}

/**
 * Create a new auth code for email verification
 * Enforces rate limiting: 3 attempts per email per hour
 */
export async function createAuthCode(
	db: D1Database,
	email: string,
	vaultId: string,
	callbackUrl: string
): Promise<CreateCodeResult> {
	const normalizedEmail = email.toLowerCase().trim();

	// Check rate limit
	const rateLimit = await db
		.prepare('SELECT attempts, window_start FROM email_rate_limits WHERE email = ?')
		.bind(normalizedEmail)
		.first<{ attempts: number; window_start: string }>();

	if (rateLimit) {
		const windowStart = new Date(rateLimit.window_start + 'Z'); // Ensure UTC
		const windowEnd = new Date(windowStart.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
		const now = new Date();

		if (now < windowEnd && rateLimit.attempts >= RATE_LIMIT_MAX) {
			const minutesLeft = Math.ceil((windowEnd.getTime() - now.getTime()) / 60000);
			return {
				success: false,
				error: `Too many attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
			};
		}

		if (now >= windowEnd) {
			// Reset window
			await db
				.prepare(
					"UPDATE email_rate_limits SET attempts = 1, window_start = datetime('now') WHERE email = ?"
				)
				.bind(normalizedEmail)
				.run();
		} else {
			// Increment attempts
			await db
				.prepare('UPDATE email_rate_limits SET attempts = attempts + 1 WHERE email = ?')
				.bind(normalizedEmail)
				.run();
		}
	} else {
		// First attempt - create rate limit record
		await db
			.prepare(
				"INSERT INTO email_rate_limits (email, attempts, window_start) VALUES (?, 1, datetime('now'))"
			)
			.bind(normalizedEmail)
			.run();
	}

	// Generate unique code
	const code = generateCode();
	const id = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

	// Store code
	await db
		.prepare(
			`INSERT INTO email_auth_codes (id, email, code, vault_id, callback_url, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(id, normalizedEmail, code, vaultId, callbackUrl, expiresAt)
		.run();

	return { success: true, code };
}

export interface VerifyCodeResult {
	success: boolean;
	email?: string;
	vaultId?: string;
	callbackUrl?: string;
	error?: string;
}

/**
 * Verify an auth code and return the associated data
 * Codes are single-use and expire after 10 minutes
 */
export async function verifyCode(
	db: D1Database,
	code: string,
	email: string
): Promise<VerifyCodeResult> {
	const normalizedEmail = email.toLowerCase().trim();
	const normalizedCode = code.toUpperCase().trim();

	const record = await db
		.prepare(
			`SELECT id, email, vault_id, callback_url, expires_at, used_at
       FROM email_auth_codes
       WHERE code = ? AND email = ?`
		)
		.bind(normalizedCode, normalizedEmail)
		.first<{
			id: string;
			email: string;
			vault_id: string;
			callback_url: string;
			expires_at: string;
			used_at: string | null;
		}>();

	if (!record) {
		return { success: false, error: 'Invalid code' };
	}

	if (record.used_at) {
		return { success: false, error: 'Code already used' };
	}

	const expiresAt = new Date(record.expires_at);
	if (expiresAt < new Date()) {
		return { success: false, error: 'Code expired' };
	}

	// Mark code as used
	await db
		.prepare("UPDATE email_auth_codes SET used_at = datetime('now') WHERE id = ?")
		.bind(record.id)
		.run();

	return {
		success: true,
		email: record.email,
		vaultId: record.vault_id,
		callbackUrl: record.callback_url
	};
}

/**
 * Clean up expired codes and old rate limit records
 * Call periodically (e.g., via scheduled worker)
 */
export async function cleanupExpiredRecords(db: D1Database): Promise<{ codes: number; limits: number }> {
	// Delete expired codes older than 24 hours
	const codesResult = await db
		.prepare("DELETE FROM email_auth_codes WHERE expires_at < datetime('now', '-24 hours')")
		.run();

	// Delete rate limit records older than 24 hours
	const limitsResult = await db
		.prepare("DELETE FROM email_rate_limits WHERE window_start < datetime('now', '-24 hours')")
		.run();

	return {
		codes: codesResult.meta.changes ?? 0,
		limits: limitsResult.meta.changes ?? 0
	};
}
