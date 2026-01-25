// Test Vault registration API
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect } from 'vitest';
import { POST, GET } from '../../../../routes/api/vaults/+server.js';

// Mock D1 database
const createMockDb = (existingVaultName?: string) => ({
	prepare: (sql: string) => ({
		bind: (...args: any[]) => ({
			first: async () => {
				if (sql.includes('SELECT') && sql.includes('name')) {
					return existingVaultName ? { name: existingVaultName } : null;
				}
				return null;
			},
			run: async () => ({ success: true })
		}),
		all: async () => ({ results: [] })
	})
} as unknown as D1Database);

describe('POST /api/vaults', () => {
	it('should reject request without API key', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Test Vault', callback_url: 'https://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should reject request with invalid API key', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'wrong-key'
			},
			body: JSON.stringify({ name: 'Test Vault', callback_url: 'https://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should reject request without name', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'secret'
			},
			body: JSON.stringify({ callback_url: 'https://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(400);
		const data = (await response.json()) as any;
		expect(data.error).toContain('name');
	});

	it('should reject request without callback_url', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'secret'
			},
			body: JSON.stringify({ name: 'Test Vault' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(400);
		const data = (await response.json()) as any;
		expect(data.error).toContain('callback_url');
	});

	it('should reject HTTP callback URL', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'secret'
			},
			body: JSON.stringify({ name: 'Test Vault', callback_url: 'http://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(400);
		const data = (await response.json()) as any;
		expect(data.error).toContain('HTTPS');
	});

	it('should reject duplicate vault name', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'secret'
			},
			body: JSON.stringify({ name: 'Existing Vault', callback_url: 'https://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb('Existing Vault'), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(409);
		const data = (await response.json()) as any;
		expect(data.error).toContain('already exists');
	});

	it('should register new vault successfully', async () => {
		const request = new Request('http://localhost/api/vaults', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'secret'
			},
			body: JSON.stringify({ name: 'New Vault', callback_url: 'https://example.com/callback' })
		});

		const response = await POST({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(201);
		const data = (await response.json()) as any;
		expect(data.id).toBeTruthy();
		expect(data.name).toBe('New Vault');
		expect(data.callback_url).toBe('https://example.com/callback');
	});
});

describe('GET /api/vaults', () => {
	it('should require API key', async () => {
		const request = new Request('http://localhost/api/vaults');

		const response = await GET({
			request,
			platform: { env: { DB: createMockDb(), API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('should list all vaults', async () => {
		const mockDb = {
			prepare: (sql: string) => ({
				all: async () => ({
					results: [
						{
							id: 'vault-1',
							name: 'Vault One',
							callback_url: 'https://vault1.example.com/callback',
							active: 1,
							created_at: '2026-01-24T00:00:00Z'
						}
					]
				})
			})
		} as unknown as D1Database;

		const request = new Request('http://localhost/api/vaults', {
			headers: { 'X-API-Key': 'secret' }
		});

		const response = await GET({
			request,
			platform: { env: { DB: mockDb, API_KEY: 'secret' } }
		} as any);

		expect(response.status).toBe(200);
		const data = (await response.json()) as any;
		expect(Array.isArray(data.vaults)).toBe(true);
		expect(data.vaults).toHaveLength(1);
	});
});
