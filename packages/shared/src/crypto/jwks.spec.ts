// Test JWKS conversion
import { describe, it, expect, beforeAll } from 'vitest';
import { pemToJwk } from './jwks.js';
import { generateKeyPair, exportSPKI } from 'jose';

let testPublicKey: string;

beforeAll(async () => {
	// Generate a test Ed25519 keypair
	const { publicKey } = await generateKeyPair('EdDSA', { extractable: true });
	testPublicKey = await exportSPKI(publicKey);
});

describe('pemToJwk', () => {
	it('should convert PEM public key to JWK format', async () => {
		const jwk = await pemToJwk(testPublicKey, 'test-key-123');

		expect(jwk).toMatchObject({
			kty: 'OKP',
			crv: 'Ed25519',
			use: 'sig',
			alg: 'EdDSA',
			kid: 'test-key-123'
		});
		expect(jwk.x).toBeTruthy();
		expect(typeof jwk.x).toBe('string');
	});

	it('should use provided key ID', async () => {
		const jwk = await pemToJwk(testPublicKey, 'custom-key-id');
		expect(jwk.kid).toBe('custom-key-id');
	});

	it('should produce base64url-encoded x value', async () => {
		const jwk = await pemToJwk(testPublicKey, 'test-key');
		// base64url should not contain +, /, or =
		expect(jwk.x).not.toMatch(/[+/=]/);
	});
});
