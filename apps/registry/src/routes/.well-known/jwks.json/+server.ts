// JWKS endpoint - public keys for JWT verification
// GET /.well-known/jwks.json
/// <reference types="@cloudflare/workers-types" />
import { json } from '@sveltejs/kit';
import { pemToJwk, type JWKS } from '@polyphony/shared/crypto';

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

	// Convert each key to JWK format
	const keys = await Promise.all(
		results.map((row: any) => pemToJwk(row.public_key, row.id))
	);

	const jwks: JWKS = { keys };

	return json(jwks, {
		headers: {
			'Cache-Control': 'public, max-age=3600',
			'Content-Type': 'application/json'
		}
	});
};
