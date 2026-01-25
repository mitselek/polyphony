// JWKS endpoint - public keys for JWT verification
// GET /.well-known/jwks.json
/// <reference types="@cloudflare/workers-types" />
import { json } from '@sveltejs/kit';
import type { JWKS } from '@polyphony/shared/crypto';

interface CloudflarePlatform {
	env: { DB: D1Database };
}

export const GET = async ({ platform }: { platform?: CloudflarePlatform }) => {
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Fetch all non-revoked signing keys
	const { results } = await db
		.prepare('SELECT id, public_key FROM signing_keys WHERE revoked_at IS NULL')
		.all();

	// Parse JWK from stored JSON and add kid (key ID)
	const keys = results.map((row: any) => {
		const jwk = JSON.parse(row.public_key);
		jwk.kid = row.id; // Add key ID to JWK
		return jwk;
	});

	const jwks: JWKS = { keys };

	return json(jwks, {
		headers: {
			'Cache-Control': 'public, max-age=3600',
			'Content-Type': 'application/json'
		}
	});
};
