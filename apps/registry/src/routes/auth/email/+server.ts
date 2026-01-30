// Email auth initiation endpoint
// POST /auth/email - Request magic link
// Issue #156

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthCode } from '$lib/server/auth-codes';
import { sendMagicLink } from '$lib/server/email';

interface EmailAuthRequest {
	email: string;
	vault_id: string;
	callback: string;
}

interface CloudflarePlatform {
	env: {
		DB: D1Database;
		RESEND_API_KEY: string;
	};
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const env = (platform as CloudflarePlatform | undefined)?.env;
	const db = env?.DB;
	const resendKey = env?.RESEND_API_KEY;

	if (!db) {
		return json({ success: false, error: 'Database unavailable' }, { status: 500 });
	}

	if (!resendKey) {
		console.error('RESEND_API_KEY not configured');
		return json({ success: false, error: 'Email service unavailable' }, { status: 500 });
	}

	// Parse request body
	let body: EmailAuthRequest;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const { email, vault_id, callback } = body;

	// Validate email format
	if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
		return json({ success: false, error: 'Invalid email address' }, { status: 400 });
	}

	// Validate required fields
	if (!vault_id || typeof vault_id !== 'string') {
		return json({ success: false, error: 'Missing vault_id' }, { status: 400 });
	}

	if (!callback || typeof callback !== 'string') {
		return json({ success: false, error: 'Missing callback' }, { status: 400 });
	}

	// Verify vault exists and callback matches
	const vault = await db
		.prepare('SELECT id, name, callback_url FROM vaults WHERE id = ? AND active = 1')
		.bind(vault_id)
		.first<{ id: string; name: string; callback_url: string }>();

	if (!vault || vault.callback_url !== callback) {
		// Don't reveal if vault exists - return generic success
		// This prevents enumeration attacks
		return json({ success: true, message: 'If valid, check your email' });
	}

	// Create auth code (includes rate limiting)
	const codeResult = await createAuthCode(db, email, vault_id, callback);

	if (!codeResult.success) {
		// Rate limit error - return 429
		return json({ success: false, error: codeResult.error }, { status: 429 });
	}

	// Build verification URL
	const verifyUrl = `${url.origin}/auth/verify?code=${codeResult.code}&email=${encodeURIComponent(email.toLowerCase())}`;

	// Send magic link email
	const emailResult = await sendMagicLink(resendKey, {
		to: email,
		code: codeResult.code!,
		verifyUrl,
		vaultName: vault.name
	});

	if (!emailResult.success) {
		console.error('Failed to send magic link:', emailResult.error);
		// Don't expose internal error details
		return json({ success: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
	}

	return json({ success: true, message: 'Check your email for a magic link' });
};
