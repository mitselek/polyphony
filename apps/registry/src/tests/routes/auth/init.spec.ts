// Test OAuth initiation endpoint
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect } from 'vitest';
import { GET } from '../../../routes/auth/+server.js';
import type { ErrorResponse } from '../../../lib/types/api.js';
import type { JWKS } from '@polyphony/shared/crypto';
import type { TestRequestEvent } from '../../helpers/types.js';

// Mock D1 database
const createMockDb = (vaultExists: boolean, callback?: string) => ({
	prepare: (sql: string) => ({
		bind: () => ({
			first: async () =>
				vaultExists
					? {
							id: 'vault-test-id',
							name: 'Test Vault',
							callback_url: callback || 'https://vault.example.com/callback',
							active: 1
						}
					: null
		})
	})
} as unknown as D1Database);

describe('GET /auth', () => {
	it('should reject missing vault_id parameter', async () => {
		const url = new URL('http://localhost/auth');
		const response = await GET({
			url,
			platform: { env: { DB: createMockDb(false), API_KEY: 'test' } }
		} satisfies TestRequestEvent);

		expect(response.status).toBe(400);
		const data = await response.json() as ErrorResponse;
		expect(data.error).toContain('vault_id');
	});

	it('should reject missing callback parameter', async () => {
		const url = new URL('http://localhost/auth?vault_id=vault-test-id');
		const response = await GET({
			url,
			platform: { env: { DB: createMockDb(true), API_KEY: 'test' } }
		} satisfies TestRequestEvent);

		expect(response.status).toBe(400);
		const data = await response.json() as ErrorResponse;
		expect(data.error).toContain('callback');
	});

	it('should reject unregistered vault_id', async () => {
		const url = new URL(
			'http://localhost/auth?vault_id=unknown-vault&callback=https://vault.example.com/callback'
		);
		const response = await GET({
			url,
			platform: { env: { DB: createMockDb(false), API_KEY: 'test' } }
		} satisfies TestRequestEvent);

		expect(response.status).toBe(400);
		const data = await response.json() as ErrorResponse;
		expect(data.error).toContain('not registered');
	});

	it('should reject mismatched callback URL', async () => {
		const url = new URL(
			'http://localhost/auth?vault_id=vault-test-id&callback=https://evil.com/callback'
		);
		const response = await GET({
			url,
			platform: {
				env: {
					DB: createMockDb(true, 'https://vault.example.com/callback'),
					API_KEY: 'test'
				}
			}
		} satisfies TestRequestEvent);

		expect(response.status).toBe(400);
		const data = await response.json() as ErrorResponse;
		expect(data.error).toContain('callback URL');
	});

	it('should redirect to Google OAuth with valid parameters', async () => {
		const url = new URL(
			'http://localhost/auth?vault_id=vault-test-id&callback=https://vault.example.com/callback'
		);
		
		try {
			await GET({
				url,
				platform: {
					env: {
						DB: createMockDb(true, 'https://vault.example.com/callback'),
						API_KEY: 'test',
						GOOGLE_CLIENT_ID: 'test-client-id'
					}
				}
			} satisfies TestRequestEvent);
			
			// Should not reach here - redirect throws
			expect(true).toBe(false);
		} catch (redirect: any) {
			// SvelteKit redirect throws an error
			expect(redirect.status).toBe(302);
			const location = redirect.location;
			expect(location).toContain('accounts.google.com/o/oauth2/v2/auth');
			expect(location).toContain('client_id=test-client-id');
			expect(location).toContain('response_type=code');
			expect(location).toContain('scope=openid+email+profile');
		}
	});
});
