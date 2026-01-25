// GET /api/auth/callback?token=xxx - Receive JWT from registry after OAuth
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importJWK, jwtVerify } from 'jose';
import { getMemberByEmail, createMember } from '$lib/server/db/members';

// Registry URL for fetching JWKS
const REGISTRY_URL = 'https://polyphony-registry.pages.dev';

// Cache JWKS for 5 minutes
let jwksCache: { keys: Array<{ kid: string; x: string; crv: string; kty: string; alg?: string }> } | null = null;
let jwksCacheExpiry = 0;

async function fetchJWKS(fetchFn: typeof fetch): Promise<typeof jwksCache> {
	const now = Date.now();
	if (jwksCache && now < jwksCacheExpiry) {
		return jwksCache;
	}

	const response = await fetchFn(`${REGISTRY_URL}/.well-known/jwks.json`);
	if (!response.ok) {
		throw new Error('Failed to fetch JWKS from registry');
	}

	jwksCache = await response.json();
	jwksCacheExpiry = now + 5 * 60 * 1000; // 5 minutes
	return jwksCache;
}

export const GET: RequestHandler = async ({ url, platform, cookies, fetch: svelteKitFetch }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Missing token parameter');
	}

	try {
		// Fetch JWKS from registry
		const jwks = await fetchJWKS(svelteKitFetch);
		if (!jwks || jwks.keys.length === 0) {
			throw error(500, 'No signing keys available');
		}

		// Import JWK directly using jose
		// Fix alg field if it's "Ed25519" (WebCrypto) instead of "EdDSA" (jose/JWT)
		const jwk = { ...jwks.keys[0] };
		if (jwk.alg === 'Ed25519') {
			jwk.alg = 'EdDSA';
		}
		const publicKey = await importJWK(jwk, 'EdDSA');

		// Verify the token using jose
		const { payload } = await jwtVerify(token, publicKey, {
			algorithms: ['EdDSA']
		});

		// Check the audience matches our vault ID
		// TODO: Make vault ID configurable via environment variable
		const expectedVaultId = 'BQ6u9ENTnZk_danhhIbUB';
		if (payload.aud !== expectedVaultId) {
			throw error(403, 'Token not issued for this vault');
		}

		// Extract email from payload
		const email = payload.email as string;
		const name = payload.name as string | undefined;

		if (!email) {
			throw error(400, 'Token missing email claim');
		}

		// Find or create member by email
		let member = await getMemberByEmail(db, email);

		if (!member) {
			// Create new member (no roles assigned - they need an invite)
			member = await createMember(db, {
				email,
				name,
				roles: [] // New OAuth users have no roles until invited/assigned
			});
		} else if (name && member.name !== name) {
			// Update name if changed
			await db
				.prepare('UPDATE members SET name = ? WHERE id = ?')
				.bind(name, member.id)
				.run();
		}

		// Create session cookie
		cookies.set('member_id', member.id, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 1 week
		});

		// Redirect to library
		return redirect(302, '/library');
	} catch (err) {
		// Re-throw SvelteKit redirects and HTTP errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Auth callback error:', err);
		if (err instanceof Error && err.message.includes('expired')) {
			throw error(401, 'Token expired. Please try logging in again.');
		}
		throw error(401, 'Invalid or expired token');
	}
};
