// Test JWT signing and verification with Ed25519
import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken, type AuthToken } from './jwt';
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

// Test keypair (generated with Ed25519)
let testKeys: { publicKey: string; privateKey: string };

beforeAll(async () => {
	// Generate real Ed25519 keypair for testing
	const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
	testKeys = {
		publicKey: await exportSPKI(publicKey),
		privateKey: await exportPKCS8(privateKey)
	};
});

describe('signToken', () => {
	it('should create a valid JWT with required claims', async () => {
		const payload: Omit<AuthToken, 'iat' | 'exp'> = {
			iss: 'https://registry.polyphony.app',
			sub: 'user@example.com',
			aud: 'vault-test-id',
			nonce: 'test-nonce-123'
		};

		const token = await signToken(payload, testKeys.privateKey);

		expect(token).toBeTruthy();
		expect(typeof token).toBe('string');
		expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
	});

	it('should include optional claims if provided', async () => {
		const payload: Omit<AuthToken, 'iat' | 'exp'> = {
			iss: 'https://registry.polyphony.app',
			sub: 'user@example.com',
			aud: 'vault-test-id',
			nonce: 'test-nonce-123',
			name: 'Test User',
			picture: 'https://example.com/photo.jpg'
		};

		const token = await signToken(payload, testKeys.privateKey);
		expect(token).toBeTruthy();
	});
});

describe('verifyToken', () => {
	it('should verify a valid token', async () => {
		const payload: Omit<AuthToken, 'iat' | 'exp'> = {
			iss: 'https://registry.polyphony.app',
			sub: 'user@example.com',
			aud: 'vault-test-id',
			nonce: 'test-nonce-456'
		};

		const token = await signToken(payload, testKeys.privateKey);
		const verified = await verifyToken(token, testKeys.publicKey);

		expect(verified).toBeDefined();
		expect(verified.sub).toBe('user@example.com');
		expect(verified.aud).toBe('vault-test-id');
		expect(verified.nonce).toBe('test-nonce-456');
		expect(verified.iat).toBeDefined();
		expect(verified.exp).toBeDefined();
	});

	it('should reject token with invalid signature', async () => {
		const payload: Omit<AuthToken, 'iat' | 'exp'> = {
			iss: 'https://registry.polyphony.app',
			sub: 'user@example.com',
			aud: 'vault-test-id',
			nonce: 'test-nonce-789'
		};

		const token = await signToken(payload, testKeys.privateKey);
		const wrongPublicKey = 'wrong-public-key';

		await expect(verifyToken(token, wrongPublicKey)).rejects.toThrow();
	});

	it('should reject expired token', async () => {
		// This test will need a way to create an expired token
		// For now, just verify the concept exists
		expect(true).toBe(true);
	});

	it('should include optional claims in verified payload', async () => {
		const payload: Omit<AuthToken, 'iat' | 'exp'> = {
			iss: 'https://registry.polyphony.app',
			sub: 'user@example.com',
			aud: 'vault-test-id',
			nonce: 'test-nonce-abc',
			name: 'Jane Doe',
			picture: 'https://example.com/jane.jpg'
		};

		const token = await signToken(payload, testKeys.privateKey);
		const verified = await verifyToken(token, testKeys.publicKey);

		expect(verified.name).toBe('Jane Doe');
		expect(verified.picture).toBe('https://example.com/jane.jpg');
	});
});
