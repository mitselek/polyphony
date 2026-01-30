// Tests for POST /auth/email endpoint
// Issue #156

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../routes/auth/email/+server';

// Mock the email service
vi.mock('../../../lib/server/email', () => ({
	sendMagicLink: vi.fn().mockResolvedValue({ success: true })
}));

// Mock the auth codes module
vi.mock('../../../lib/server/auth-codes', () => ({
	createAuthCode: vi.fn().mockResolvedValue({ success: true, code: 'ABC123' })
}));

import { sendMagicLink } from '../../../lib/server/email';
import { createAuthCode } from '../../../lib/server/auth-codes';

interface ApiResponse {
	success: boolean;
	message?: string;
	error?: string;
}

function createMockRequest(body: unknown): Request {
	return new Request('http://localhost/auth/email', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function createMockDb(vault?: { id: string; name: string; callback_url: string }) {
	return {
		prepare: () => ({
			bind: () => ({
				first: async () => vault || null
			})
		})
	} as unknown as D1Database;
}

describe('POST /auth/email', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should reject invalid email format', async () => {
		const request = createMockRequest({
			email: 'not-an-email',
			vault_id: 'vault-123',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb(),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(false);
		expect(data.error).toContain('email');
	});

	it('should reject missing vault_id', async () => {
		const request = createMockRequest({
			email: 'user@example.com',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb(),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(false);
		expect(data.error).toContain('vault_id');
	});

	it('should reject missing callback', async () => {
		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'vault-123'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb(),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(false);
		expect(data.error).toContain('callback');
	});

	it('should return generic success for unregistered vault (prevent enumeration)', async () => {
		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'unknown-vault',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb(), // No vault returned
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(true);
		// Should NOT call createAuthCode or sendMagicLink
		expect(createAuthCode).not.toHaveBeenCalled();
		expect(sendMagicLink).not.toHaveBeenCalled();
	});

	it('should return generic success for mismatched callback (prevent enumeration)', async () => {
		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'vault-123',
			callback: 'https://evil.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb({
						id: 'vault-123',
						name: 'Test Vault',
						callback_url: 'https://vault.example.com/callback' // Different from request
					}),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(true);
		// Should NOT call createAuthCode or sendMagicLink
		expect(createAuthCode).not.toHaveBeenCalled();
		expect(sendMagicLink).not.toHaveBeenCalled();
	});

	it('should create code and send email for valid request', async () => {
		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'vault-123',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb({
						id: 'vault-123',
						name: 'Test Vault',
						callback_url: 'https://vault.example.com/callback'
					}),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(true);
		expect(data.message).toContain('email');

		// Verify auth code was created
		expect(createAuthCode).toHaveBeenCalledWith(
			expect.anything(),
			'user@example.com',
			'vault-123',
			'https://vault.example.com/callback'
		);

		// Verify email was sent
		expect(sendMagicLink).toHaveBeenCalledWith(
			'test-key',
			expect.objectContaining({
				to: 'user@example.com',
				code: 'ABC123',
				vaultName: 'Test Vault'
			})
		);
	});

	it('should return 429 when rate limited', async () => {
		// Mock rate limit error
		vi.mocked(createAuthCode).mockResolvedValueOnce({
			success: false,
			error: 'Too many attempts. Try again in 45 minutes.'
		});

		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'vault-123',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb({
						id: 'vault-123',
						name: 'Test Vault',
						callback_url: 'https://vault.example.com/callback'
					}),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(429);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(false);
		expect(data.error).toContain('Too many attempts');
	});

	it('should return 500 when email service fails', async () => {
		vi.mocked(sendMagicLink).mockResolvedValueOnce({
			success: false,
			error: 'Resend API error'
		});

		const request = createMockRequest({
			email: 'user@example.com',
			vault_id: 'vault-123',
			callback: 'https://vault.example.com/callback'
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/auth/email'),
			platform: {
				env: {
					DB: createMockDb({
						id: 'vault-123',
						name: 'Test Vault',
						callback_url: 'https://vault.example.com/callback'
					}),
					RESEND_API_KEY: 'test-key'
				}
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(500);
		const data = (await response.json()) as ApiResponse;
		expect(data.success).toBe(false);
		expect(data.error).toContain('send email');
	});
});
