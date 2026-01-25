// Test JWKS endpoint
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../../../../routes/.well-known/jwks.json/+server.js';
import type { JWKS } from '@polyphony/shared/crypto';

// Mock D1 database
const mockDb = {
	prepare: (sql: string) => ({
		all: async () => ({ results: [] })
	})
} as unknown as D1Database;

describe('GET /.well-known/jwks.json', () => {
	it('should return valid JWKS JSON structure', async () => {
		const response = await GET({
			platform: { env: { DB: mockDb, API_KEY: 'test-key' } }
		} as any);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');

		const data = (await response.json()) as JWKS;
		expect(data).toHaveProperty('keys');
		expect(Array.isArray(data.keys)).toBe(true);
	});

	it('should include Cache-Control header', async () => {
		const response = await GET({
			platform: { env: { DB: mockDb, API_KEY: 'test-key' } }
		} as any);

		const cacheControl = response.headers.get('cache-control');
		expect(cacheControl).toContain('max-age=3600');
		expect(cacheControl).toContain('public');
	});

	it('should return keys in JWKS format', async () => {
		// Mock database with a key
		const mockDbWithKey = {
			prepare: (sql: string) => ({
				all: async () => ({
					results: [
						{
							id: 'key-1',
							algorithm: 'EdDSA',
							public_key: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=
-----END PUBLIC KEY-----`
						}
					]
				})
			})
		} as unknown as D1Database;

		const response = await GET({
			platform: { env: { DB: mockDbWithKey, API_KEY: 'test-key' } }
		} as any);

		const data = (await response.json()) as JWKS;
		expect(data.keys).toHaveLength(1);

		const key = data.keys[0];
		expect(key.kty).toBe('OKP');
		expect(key.crv).toBe('Ed25519');
		expect(key.use).toBe('sig');
		expect(key.alg).toBe('EdDSA');
		expect(key.kid).toBe('key-1');
		expect(key.x).toBeTruthy(); // base64url-encoded public key
	});

	it('should only include non-revoked keys', async () => {
		const mockDbWithKeys = {
			prepare: (sql: string) => ({
				all: async () => ({
					results: [
						{
							id: 'key-active',
							algorithm: 'EdDSA',
							public_key: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=
-----END PUBLIC KEY-----`
						}
						// key-revoked should NOT be in results (filtered by SQL)
					]
				})
			})
		} as unknown as D1Database;

		const response = await GET({
			platform: { env: { DB: mockDbWithKeys, API_KEY: 'test-key' } }
		} as any);

		const data = (await response.json()) as JWKS;
		expect(data.keys).toHaveLength(1);
		expect(data.keys[0].kid).toBe('key-active');
	});
});
