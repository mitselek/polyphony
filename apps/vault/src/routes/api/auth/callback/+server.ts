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

		// Check if there's an invite token from the accept flow
		const inviteToken = cookies.get('invite_token');
		let inviteRoles: string[] = [];
		let inviteVoicePart: string | null = null;

		if (inviteToken) {
			// Validate and retrieve invite details
			const invite = await db
				.prepare(
					`SELECT id, roles, voice_part, status, expires_at
					 FROM invites
					 WHERE token = ?`
				)
				.bind(inviteToken)
				.first<{
					id: string;
					roles: string;
					voice_part: string | null;
					status: string;
					expires_at: string;
				}>();

			if (invite && invite.status === 'pending') {
				const now = new Date();
				const expiresAt = new Date(invite.expires_at);
				
				if (now <= expiresAt) {
					// Valid invite - use its roles and voice part
					inviteRoles = JSON.parse(invite.roles);
					inviteVoicePart = invite.voice_part;

					// Mark invite as accepted
					await db
						.prepare(
							`UPDATE invites
							 SET status = 'accepted',
							     accepted_at = datetime('now'),
							     accepted_by_email = ?
							 WHERE id = ?`
						)
						.bind(email, invite.id)
						.run();
				}
			}

			// Clear the invite token cookie
			cookies.delete('invite_token', { path: '/' });
		}

		// Find or create member by email
		let member = await getMemberByEmail(db, email);

		if (!member) {
			// Create new member with roles from invite (or empty if no invite)
			member = await createMember(db, {
				email,
				name,
				roles: inviteRoles,
				voice_part: inviteVoicePart
			});
		} else {
			// Existing member - update name if changed
			if (name && member.name !== name) {
				await db
					.prepare('UPDATE members SET name = ? WHERE id = ?')
					.bind(name, member.id)
					.run();
			}

			// If they came via invite, add the invited roles to their existing roles
			if (inviteRoles.length > 0) {
				const currentRoles = member.roles;
				const newRoles = Array.from(new Set([...currentRoles, ...inviteRoles]));
				
				// Delete existing roles
				await db
					.prepare('DELETE FROM member_roles WHERE member_id = ?')
					.bind(member.id)
					.run();

				// Insert updated roles
				for (const role of newRoles) {
					await db
						.prepare('INSERT INTO member_roles (member_id, role) VALUES (?, ?)')
						.bind(member.id, role)
						.run();
				}

				// Update voice part if provided in invite
				if (inviteVoicePart) {
					await db
						.prepare('UPDATE members SET voice_part = ? WHERE id = ?')
						.bind(inviteVoicePart, member.id)
						.run();
				}
			}
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
