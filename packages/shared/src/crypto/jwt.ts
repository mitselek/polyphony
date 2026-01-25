// JWT signing and verification with Ed25519
// Implements #14

import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import type { AuthToken } from '../types/index.js';

const TOKEN_EXPIRY_SECONDS = 5 * 60; // 5 minutes

export async function signToken(
	payload: Omit<AuthToken, 'iat' | 'exp'>,
	privateKey: string
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const exp = now + TOKEN_EXPIRY_SECONDS;

	// Import Ed25519 private key (PKCS8 PEM format)
	const key = await importPKCS8(privateKey, 'EdDSA');

	// Build JWT
	const jwt = new SignJWT({
		...payload,
		iat: now,
		exp
	})
		.setProtectedHeader({ alg: 'EdDSA' })
		.setIssuer(payload.iss)
		.setSubject(payload.sub)
		.setAudience(payload.aud)
		.setIssuedAt(now)
		.setExpirationTime(exp);

	return await jwt.sign(key);
}

export async function verifyToken(token: string, publicKey: string): Promise<AuthToken> {
	// Import Ed25519 public key (SPKI PEM format)
	const key = await importSPKI(publicKey, 'EdDSA');

	// Verify and decode
	const { payload } = await jwtVerify(token, key, {
		algorithms: ['EdDSA']
	});

	// Type check and return
	if (
		typeof payload.iss !== 'string' ||
		typeof payload.sub !== 'string' ||
		typeof payload.aud !== 'string' ||
		typeof payload.iat !== 'number' ||
		typeof payload.exp !== 'number' ||
		typeof payload.nonce !== 'string' ||
		typeof payload.email !== 'string'
	) {
		throw new Error('Invalid token payload structure');
	}

	return {
		iss: payload.iss,
		sub: payload.sub,
		aud: payload.aud,
		iat: payload.iat,
		exp: payload.exp,
		nonce: payload.nonce,
		email: payload.email,
		name: typeof payload.name === 'string' ? payload.name : undefined,
		picture: typeof payload.picture === 'string' ? payload.picture : undefined
	};
}
