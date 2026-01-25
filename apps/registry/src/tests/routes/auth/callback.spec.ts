// Test OAuth callback endpoint
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../../../routes/auth/callback/+server.js';

// Mock fetch for Google token exchange
const createMockFetch = (success: boolean = true) => {
	return vi.fn(async (url: string) => {
		if (url.includes('oauth2.googleapis.com/token')) {
			if (!success) {
				return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
			}
			return new Response(
				JSON.stringify({
					access_token: 'mock-access-token',
					id_token: 'mock-id-token'
				}),
				{ status: 200 }
			);
		}
		if (url.includes('www.googleapis.com/oauth2/v3/userinfo')) {
			return new Response(
				JSON.stringify({
					email: 'user@example.com',
					name: 'Test User',
					picture: 'https://example.com/photo.jpg'
				}),
				{ status: 200 }
			);
		}
		return new Response('Not found', { status: 404 });
	});
};

// Mock D1 database with signing key
const createMockDb = () => ({
	prepare: (sql: string) => ({
		first: async () => ({
			id: 'key-1',
			private_key: `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIHcHbQpzGKV9PBbBclGyZkXfTC+H68CZKrF3+6UduSwq
-----END PRIVATE KEY-----`,
			public_key: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=
-----END PUBLIC KEY-----`
		})
	})
} as unknown as D1Database);

describe('GET /auth/callback', () => {
	it('should reject missing code parameter', async () => {
		const url = new URL('http://localhost/auth/callback?state={}');
		const response = await GET({
			url,
			platform: { env: { DB: createMockDb(), API_KEY: 'test' } },
			fetch: createMockFetch()
		} as any);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain('Missing authorization code');
	});

	it('should reject missing state parameter', async () => {
		const url = new URL('http://localhost/auth/callback?code=test-code');
		const response = await GET({
			url,
			platform: { env: { DB: createMockDb(), API_KEY: 'test' } },
			fetch: createMockFetch()
		} as any);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain('Missing state');
	});

	it('should exchange code for tokens and redirect with JWT', async () => {
		const state = JSON.stringify({
			vaultId: 'vault-test-id',
			callbackUrl: 'https://vault.example.com/callback'
		});
		const url = new URL(`http://localhost/auth/callback?code=test-code&state=${state}`);
		
		try {
			await GET({
				url,
				platform: {
					env: {
						DB: createMockDb(),
						API_KEY: 'test',
						GOOGLE_CLIENT_ID: 'test-client-id',
						GOOGLE_CLIENT_SECRET: 'test-client-secret'
					}
				},
				fetch: createMockFetch(true)
			} as any);
			
			// Should not reach here - redirect throws
			expect(true).toBe(false);
		} catch (redirect: any) {
			// SvelteKit redirect throws an error
			expect(redirect.status).toBe(302);
			expect(redirect.location).toContain('https://vault.example.com/callback');
			expect(redirect.location).toContain('token=');
		}
	});

	it('should handle Google token exchange failure', async () => {
		const state = JSON.stringify({
			vaultId: 'vault-test-id',
			callbackUrl: 'https://vault.example.com/callback'
		});
		const url = new URL(`http://localhost/auth/callback?code=bad-code&state=${state}`);
		
		const response = await GET({
			url,
			platform: {
				env: {
					DB: createMockDb(),
					API_KEY: 'test',
					GOOGLE_CLIENT_ID: 'test-client-id',
					GOOGLE_CLIENT_SECRET: 'test-client-secret'
				}
			},
			fetch: createMockFetch(false)
		} as any);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain('Failed to exchange');
	});
});
