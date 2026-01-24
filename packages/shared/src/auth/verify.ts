import { jwtVerify, importSPKI } from 'jose';

export interface VerifyOptions {
	registryUrl: string; // To fetch JWKS
	vaultId: string; // Expected 'aud' claim
}

export interface VerifiedToken {
	email: string;
	name?: string;
	picture?: string;
	nonce: string;
}

interface JWK {
	kty: string;
	crv: string;
	x: string;
	kid: string;
}

interface JWKS {
	keys: JWK[];
}

// Cache for JWKS by registryUrl
interface CacheEntry {
	jwks: JWKS;
	timestamp: number;
}

const jwksCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Fetch JWKS from Registry (with caching)
 */
async function fetchJWKS(registryUrl: string): Promise<JWKS> {
	const now = Date.now();
	const cached = jwksCache.get(registryUrl);

	// Return cached JWKS if still valid
	if (cached && now - cached.timestamp < CACHE_TTL) {
		return cached.jwks;
	}

	// Fetch fresh JWKS
	const jwksUrl = new URL('/.well-known/jwks.json', registryUrl);
	const response = await fetch(jwksUrl.toString());

	if (!response.ok) {
		throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
	}

	const jwks: JWKS = await response.json();

	// Cache it
	jwksCache.set(registryUrl, {
		jwks,
		timestamp: now
	});

	return jwks;
}

/**
 * Convert JWK to PEM format for jose library
 */
function jwkToPem(jwk: JWK): string {
	// Ed25519 public key is 32 bytes
	// JWK x coordinate is base64url encoded
	const xBytes = Buffer.from(jwk.x, 'base64url');

	// SPKI format for Ed25519:
	// 0x30 0x2a (SEQUENCE, 42 bytes)
	// 0x30 0x05 (SEQUENCE, 5 bytes)
	// 0x06 0x03 0x2b 0x65 0x70 (OID 1.3.101.112 = Ed25519)
	// 0x03 0x21 (BIT STRING, 33 bytes)
	// 0x00 (no unused bits)
	// ... 32 bytes of public key ...

	const oid = Buffer.from([0x06, 0x03, 0x2b, 0x65, 0x70]);
	const algoId = Buffer.concat([Buffer.from([0x30, 0x05]), oid]);
	const pubKeyBits = Buffer.concat([Buffer.from([0x03, 0x21, 0x00]), xBytes]);
	const spki = Buffer.concat([Buffer.from([0x30, 0x2a]), algoId, pubKeyBits]);

	// Convert to PEM format
	const base64 = spki.toString('base64');
	const pem =
		'-----BEGIN PUBLIC KEY-----\n' +
		base64.match(/.{1,64}/g)!.join('\n') +
		'\n-----END PUBLIC KEY-----';

	return pem;
}

/**
 * Verify a JWT token issued by the Registry
 *
 * @param token - JWT token to verify
 * @param options - Verification options (registryUrl, vaultId)
 * @returns Verified token payload with user information
 * @throws Error if token is invalid, expired, or has wrong audience
 */
export async function verifyAuthToken(
	token: string,
	options: VerifyOptions
): Promise<VerifiedToken> {
	const { registryUrl, vaultId } = options;

	try {
		// Fetch JWKS (cached or fresh)
		const jwks = await fetchJWKS(registryUrl);

		if (!jwks.keys || jwks.keys.length === 0) {
			throw new Error('JWKS contains no keys');
		}

		// Try each key until one works (typically only one key)
		let lastError: Error | null = null;
		for (const jwk of jwks.keys) {
			try {
				// Convert JWK to PEM
				const pem = jwkToPem(jwk);
				const key = await importSPKI(pem, 'EdDSA');

				// Verify token signature and claims
				const { payload } = await jwtVerify(token, key, {
					issuer: registryUrl,
					audience: vaultId
				});

				// Extract and validate required claims
				if (typeof payload.email !== 'string' || !payload.email) {
					throw new Error('Token missing required claim: email');
				}

				if (typeof payload.nonce !== 'string' || !payload.nonce) {
					throw new Error('Token missing required claim: nonce');
				}

				// Build result with validated claims
				const result: VerifiedToken = {
					email: payload.email,
					nonce: payload.nonce
				};

				// Add optional claims if present
				if (typeof payload.name === 'string') {
					result.name = payload.name;
				}

				if (typeof payload.picture === 'string') {
					result.picture = payload.picture;
				}

				return result;
			} catch (error) {
				// Save error and try next key
				lastError = error as Error;
				continue;
			}
		}

		// No key worked
		throw lastError || new Error('Failed to verify token with any key');
	} catch (error) {
		// Re-throw with more context
		if (error instanceof Error) {
			throw new Error(`Token verification failed: ${error.message}`);
		}
		throw error;
	}
}
