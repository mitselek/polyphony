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

// CORS headers for cross-origin requests from vaults
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

// Helper to add CORS headers to JSON responses
function corsJson(data: unknown, init?: ResponseInit) {
	return json(data, {
		...init,
		headers: { ...CORS_HEADERS, ...init?.headers }
	});
}

// Handle preflight requests
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

interface Vault { id: string; name: string; callback_url: string; }

/** Validate request body and return parsed data or error response */
function validateRequest(body: unknown): { data?: EmailAuthRequest; error?: Response } {
	const { email, vault_id, callback } = body as EmailAuthRequest;
	if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
		return { error: corsJson({ success: false, error: 'Invalid email address' }, { status: 400 }) };
	}
	if (!vault_id || typeof vault_id !== 'string') {
		return { error: corsJson({ success: false, error: 'Missing vault_id' }, { status: 400 }) };
	}
	if (!callback || typeof callback !== 'string') {
		return { error: corsJson({ success: false, error: 'Missing callback' }, { status: 400 }) };
	}
	return { data: { email, vault_id, callback } };
}

/** Lookup vault and verify callback matches */
async function lookupVault(db: D1Database, vaultId: string, callback: string): Promise<Vault | null> {
	const vault = await db
		.prepare('SELECT id, name, callback_url FROM vaults WHERE id = ? AND active = 1')
		.bind(vaultId)
		.first<Vault>();
	return vault?.callback_url === callback ? vault : null;
}

interface SendMagicLinkContext {
	db: D1Database;
	resendKey: string;
	origin: string;
	email: string;
	vaultId: string;
	callback: string;
	vaultName: string;
}

/** Create auth code and send magic link email, return response */
async function createAndSendMagicLink(ctx: SendMagicLinkContext): Promise<Response> {
	const codeResult = await createAuthCode(ctx.db, ctx.email, ctx.vaultId, ctx.callback);
	if (!codeResult.success) return corsJson({ success: false, error: codeResult.error }, { status: 429 });

	const verifyUrl = `${ctx.origin}/auth/verify?code=${codeResult.code}&email=${encodeURIComponent(ctx.email.toLowerCase())}`;
	const emailResult = await sendMagicLink(ctx.resendKey, { to: ctx.email, code: codeResult.code!, verifyUrl, vaultName: ctx.vaultName });

	if (!emailResult.success) return corsJson({ success: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
	return corsJson({ success: true, message: 'Check your email for a magic link' });
}

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const env = (platform as CloudflarePlatform | undefined)?.env;
	if (!env?.DB) return corsJson({ success: false, error: 'Database unavailable' }, { status: 500 });
	if (!env.RESEND_API_KEY) return corsJson({ success: false, error: 'Email service unavailable' }, { status: 500 });

	let body: unknown;
	try { body = await request.json(); } catch { return corsJson({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

	const validation = validateRequest(body);
	if (validation.error) return validation.error;
	const { email, vault_id, callback } = validation.data!;

	const vault = await lookupVault(env.DB, vault_id, callback);
	if (!vault) return corsJson({ success: true, message: 'If valid, check your email' });

	return createAndSendMagicLink({
		db: env.DB, resendKey: env.RESEND_API_KEY, origin: url.origin,
		email, vaultId: vault_id, callback, vaultName: vault.name
	});
};
