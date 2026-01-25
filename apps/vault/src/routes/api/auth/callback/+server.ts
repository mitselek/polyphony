// GET /api/auth/callback?token=xxx - Receive JWT from registry after OAuth
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyToken } from '@polyphony/shared/crypto';
import { nanoid } from 'nanoid';

// Registry URL for fetching JWKS
const REGISTRY_URL = 'https://polyphony-registry.pages.dev';

// Cache JWKS for 5 minutes
let jwksCache: { keys: Array<{ kid: string; x: string; crv: string; kty: string }> } | null = null;
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

// Convert JWK to PEM format for jose library
async function jwkToPem(jwk: { x: string; crv: string; kty: string }): Promise<string> {
	// For Ed25519, we need to construct SPKI format
	// The 'x' value is the raw public key in base64url
	const x = jwk.x.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (x.length % 4)) % 4);
	const base64 = x + padding;

	// Ed25519 public key SPKI prefix (ASN.1 header for Ed25519)
	const prefix = new Uint8Array([
		0x30, 0x2a, // SEQUENCE, 42 bytes
		0x30, 0x05, // SEQUENCE, 5 bytes
		0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
		0x03, 0x21, 0x00 // BIT STRING, 33 bytes (with leading 0)
	]);

	// Decode base64 to get raw key bytes
	const rawKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

	// Combine prefix and raw key
	const spki = new Uint8Array(prefix.length + rawKey.length);
	spki.set(prefix);
	spki.set(rawKey, prefix.length);

	// Convert to base64 and format as PEM
	const spkiBase64 = btoa(String.fromCharCode(...spki));
	const lines = spkiBase64.match(/.{1,64}/g) || [];
	return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
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

		// Use the first active key
		const jwk = jwks.keys[0];
		const publicKeyPem = await jwkToPem(jwk);

		// Verify the token
		const payload = await verifyToken(token, publicKeyPem);

		// Check the audience matches our vault ID
		// TODO: Make vault ID configurable via environment variable
		const expectedVaultId = 'BQ6u9ENTnZk_danhhIbUB';
		if (payload.aud !== expectedVaultId) {
			throw error(403, 'Token not issued for this vault');
		}

		// Find or create member by email
		let member = await db
			.prepare('SELECT id, email, name, role FROM members WHERE email = ?')
			.bind(payload.email)
			.first<{ id: string; email: string; name: string | null; role: string }>();

		if (!member) {
			// Create new member with 'singer' role (default for new OAuth users)
			const memberId = nanoid(21);
			await db
				.prepare(
					'INSERT INTO members (id, email, name, role, created_at) VALUES (?, ?, ?, ?, ?)'
				)
				.bind(memberId, payload.email, payload.name || null, 'singer', new Date().toISOString())
				.run();

			member = { id: memberId, email: payload.email, name: payload.name || null, role: 'singer' };
		} else if (payload.name && member.name !== payload.name) {
			// Update name if changed
			await db
				.prepare('UPDATE members SET name = ? WHERE id = ?')
				.bind(payload.name, member.id)
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
		console.error('Auth callback error:', err);
		if (err instanceof Error && err.message.includes('expired')) {
			throw error(401, 'Token expired. Please try logging in again.');
		}
		throw error(401, 'Invalid or expired token');
	}
};
