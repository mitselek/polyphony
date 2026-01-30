// Email verification endpoint
// GET /auth/verify?code=ABC123&email=user@example.com
// Issue #156

import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyCode } from '$lib/server/auth-codes';
import { signToken } from '@polyphony/shared/crypto';
import { nanoid } from 'nanoid';

interface CloudflarePlatform {
	env: {
		DB: D1Database;
	};
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = (platform as CloudflarePlatform | undefined)?.env?.DB;

	if (!db) {
		throw error(500, 'Database unavailable');
	}

	const code = url.searchParams.get('code');
	const email = url.searchParams.get('email');

	if (!code || !email) {
		throw redirect(303, `/auth/error?message=${encodeURIComponent('Missing code or email')}`);
	}

	// Verify the code
	const result = await verifyCode(db, code, email);

	if (!result.success) {
		// Redirect to error page with message and callback for retry
		const errorParams = new URLSearchParams({
			message: result.error || 'Verification failed'
		});

		if (result.callbackUrl) {
			errorParams.set('callback', result.callbackUrl);
		}

		throw redirect(303, `/auth/error?${errorParams.toString()}`);
	}

	// Get signing key
	const signingKey = await db
		.prepare(
			'SELECT private_key FROM signing_keys WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1'
		)
		.first<{ private_key: string }>();

	if (!signingKey) {
		console.error('No active signing key found');
		throw error(500, 'Authentication service misconfigured');
	}

	// Sign JWT (same format as Google OAuth callback)
	const token = await signToken(
		{
			iss: 'https://registry.polyphony.app',
			sub: result.email!,
			aud: result.vaultId!,
			nonce: nanoid(),
			email: result.email!
			// No name/picture for email auth (unlike Google OAuth)
		},
		signingKey.private_key
	);

	// Redirect to vault callback with token
	const callbackUrl = new URL(result.callbackUrl!);
	callbackUrl.searchParams.set('token', token);

	throw redirect(303, callbackUrl.toString());
};
