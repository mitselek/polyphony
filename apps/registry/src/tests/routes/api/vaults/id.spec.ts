// Test individual vault operations
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect } from 'vitest';
import { GET, PUT, DELETE } from '../../../../routes/api/vaults/[id]/+server.js';
import type { VaultResponse, ErrorResponse } from '../../../../lib/types/api.js';

// Mock D1 database
const createMockDb = (vaultExists: boolean = true) => ({
	prepare: (sql: string) => ({
		bind: (...args: any[]) => ({
			first: async () => {
				if (!vaultExists) return null;
				return {
					id: 'vault-test-id',
					name: 'Test Vault',
					callback_url: 'https://example.com/callback',
					active: 1,
					created_at: '2026-01-24T00:00:00Z'
				};
			},
			run: async () => ({ success: true })
		})
	})
} as unknown as D1Database);

describe('GET /api/vaults/[id]', () => {
	it('should require API key', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id');

		const response = await GET({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should return 404 for non-existent vault', async () => {
		const request = new Request('http://localhost/api/vaults/unknown-id', {
			headers: { 'X-API-Key': 'secret' }
		});

		const response = await GET({
			request,
			params: { id: 'unknown-id' },
			platform: { env: { DB: createMockDb(false), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(404);
	});

	it('should return vault details', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			headers: { 'X-API-Key': 'secret' }
		});

		const response = await GET({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(200);
		const data = await response.json() as VaultResponse;
		expect(data.id).toBe('vault-test-id');
		expect(data.name).toBe('Test Vault');
	});
});

describe('PUT /api/vaults/[id]', () => {
	it('should require API key', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			method: 'PUT',
			body: JSON.stringify({ callback_url: 'https://new.example.com/callback' })
		});

		const response = await PUT({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should reject HTTP callback URL', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			method: 'PUT',
			headers: { 'X-API-Key': 'secret' },
			body: JSON.stringify({ callback_url: 'http://new.example.com/callback' })
		});

		const response = await PUT({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(400);
		const data = await response.json() as ErrorResponse;
		expect(data.error).toContain('HTTPS');
	});

	it('should update callback URL', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			method: 'PUT',
			headers: { 'X-API-Key': 'secret' },
			body: JSON.stringify({ callback_url: 'https://new.example.com/callback' })
		});

		const response = await PUT({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(200);
		const data = (await response.json()) as any;
		expect(data.id).toBe('vault-test-id');
	});
});

describe('DELETE /api/vaults/[id]', () => {
	it('should require API key', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			method: 'DELETE'
		});

		const response = await DELETE({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should deactivate vault', async () => {
		const request = new Request('http://localhost/api/vaults/vault-test-id', {
			method: 'DELETE',
			headers: { 'X-API-Key': 'secret' }
		});

		const response = await DELETE({
			request,
			params: { id: 'vault-test-id' },
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(204);
	});
});
