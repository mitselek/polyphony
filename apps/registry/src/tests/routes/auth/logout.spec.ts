// Test logout endpoint
/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from 'vitest';
import { GET, POST } from '../../../routes/auth/logout/+server.js';

// SSO cookie constants (must match implementation)
const SSO_COOKIE_NAME = 'polyphony_sso';
const SSO_COOKIE_DOMAIN = '.polyphony.uk';

// Mock cookies helper
const createMockCookies = () => {
	const deleted: Array<{ name: string; opts: object }> = [];
	return {
		delete: (name: string, opts: object) => {
			deleted.push({ name, opts });
		},
		getDeleted: () => deleted
	};
};

describe('GET /auth/logout', () => {
	it('should clear polyphony_sso cookie', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout');

		const response = await GET({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof GET>[0]);

		// Verify cookie was deleted
		const deleted = mockCookies.getDeleted();
		expect(deleted.length).toBe(1);
		expect(deleted[0].name).toBe(SSO_COOKIE_NAME);
		expect(deleted[0].opts).toMatchObject({
			domain: SSO_COOKIE_DOMAIN,
			path: '/'
		});
	});

	it('should redirect to default URL when no callback provided', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout');

		const response = await GET({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://polyphony.uk');
	});

	it('should redirect to callback URL when provided', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout?callback=https://mychoir.polyphony.uk');

		const response = await GET({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://mychoir.polyphony.uk');
	});

	it('should only allow polyphony.uk subdomains as callback (security)', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout?callback=https://evil.com');

		const response = await GET({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof GET>[0]);

		// Should redirect to default, not evil.com
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://polyphony.uk');
	});
});

describe('POST /auth/logout', () => {
	it('should clear polyphony_sso cookie', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout');

		const response = await POST({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof POST>[0]);

		// Verify cookie was deleted
		const deleted = mockCookies.getDeleted();
		expect(deleted.length).toBe(1);
		expect(deleted[0].name).toBe(SSO_COOKIE_NAME);
	});

	it('should redirect to callback URL', async () => {
		const mockCookies = createMockCookies();
		const url = new URL('http://localhost/auth/logout?callback=https://choir.polyphony.uk/members');

		const response = await POST({
			url,
			cookies: mockCookies
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://choir.polyphony.uk/members');
	});
});
