// GET /api/auth/callback?token=xxx - Receive JWT from registry after OAuth
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importJWK, jwtVerify, type JWTPayload } from 'jose';
import { getMemberByEmailId } from '$lib/server/db/members';
import { acceptInvite } from '$lib/server/db/invites';
import type { Cookies } from '@sveltejs/kit';

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

async function verifyJWT(token: string, fetchFn: typeof fetch, expectedVaultId: string): Promise<JWTPayload> {
	const jwks = await fetchJWKS(fetchFn);
	if (!jwks || jwks.keys.length === 0) {
		throw error(500, 'No signing keys available');
	}

	// Import JWK (fix alg if needed)
	const jwk = { ...jwks.keys[0] };
	if (jwk.alg === 'Ed25519') {
		jwk.alg = 'EdDSA';
	}
	const publicKey = await importJWK(jwk, 'EdDSA');

	// Verify token
	const { payload } = await jwtVerify(token, publicKey, {
		algorithms: ['EdDSA']
	});

	// Check audience
	if (payload.aud !== expectedVaultId) {
		throw error(403, `Token not issued for this vault (expected: ${expectedVaultId}, got: ${payload.aud})`);
	}

	return payload;
}

async function handleInviteAcceptance(
	db: D1Database,
	inviteToken: string,
	email: string,
	cookies: Cookies
): Promise<never> {
	const inviteResult = await acceptInvite(db, inviteToken, email);

	if (!inviteResult.success) {
		const errorMsg = inviteResult.error ?? 'Failed to accept invitation';
		throw redirect(302, '/login?error=' + encodeURIComponent(errorMsg));
	}

	// Set session for newly registered member
	cookies.set('member_id', inviteResult.memberId!, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	throw redirect(302, '/profile?welcome=true');
}

async function handleLogin(
	db: D1Database,
	email: string,
	name: string | undefined,
	cookies: Cookies
): Promise<never> {
	let member = await getMemberByEmailId(db, email);

	if (!member) {
		throw redirect(302, '/login?error=not_registered');
	}

	// Update name if changed from OAuth provider
	if (name && member.name !== name) {
		await db.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name, member.id).run();
	}

	// Create session cookie
	cookies.set('member_id', member.id, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7 // 1 week
	});

	throw redirect(302, '/library');
}

function validateTokenParam(url: URL): string {
	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Missing token parameter');
	}
	return token;
}

function validateEmail(payload: JWTPayload): string {
	const email = payload.email as string;
	if (!email) {
		throw error(400, 'Token missing email claim');
	}
	return email;
}

async function routeToHandler(
	db: D1Database,
	cookies: Cookies,
	email: string,
	name: string | undefined
): Promise<never> {
	// Check for pending invite token in cookie (set by /api/auth/login)
	const inviteToken = cookies.get('pending_invite');
	if (inviteToken) {
		// Clear the cookie
		cookies.delete('pending_invite', { path: '/' });
		return await handleInviteAcceptance(db, inviteToken, email, cookies);
	}
	return await handleLogin(db, email, name, cookies);
}

async function processAuthCallback(
	db: D1Database,
	url: URL,
	cookies: Cookies,
	fetchFn: typeof fetch,
	vaultId: string
): Promise<never> {
	const token = validateTokenParam(url);
	const payload = await verifyJWT(token, fetchFn, vaultId);
	const email = validateEmail(payload);
	const name = payload.name as string | undefined;
	return await routeToHandler(db, cookies, email, name);
}

function handleAuthError(err: unknown): never {
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

export const GET: RequestHandler = async ({ url, platform, cookies, fetch: svelteKitFetch }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const vaultId = platform?.env?.VAULT_ID ?? 'localhost-dev-vault';
		return await processAuthCallback(db, url, cookies, svelteKitFetch, vaultId);
	} catch (err) {
		return handleAuthError(err);
	}
};
