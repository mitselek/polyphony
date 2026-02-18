// Unit tests for hooks.server.ts
import { describe, it, expect } from 'vitest';
import { extractSubdomain, isPublicOrAuthRoute } from './hooks.server';

describe('extractSubdomain', () => {
	describe('localhost handling', () => {
		it('returns dev fallback for plain localhost', () => {
			expect(extractSubdomain('localhost')).toBe('crede');
		});

		it('returns dev fallback for localhost with port', () => {
			expect(extractSubdomain('localhost:5173')).toBe('crede');
		});

		it('extracts subdomain from subdomain.localhost', () => {
			expect(extractSubdomain('crede.localhost')).toBe('crede');
			expect(extractSubdomain('testorg.localhost')).toBe('testorg');
		});

		it('extracts subdomain from subdomain.localhost with port', () => {
			expect(extractSubdomain('crede.localhost:5173')).toBe('crede');
			expect(extractSubdomain('myorg.localhost:3000')).toBe('myorg');
		});
	});

	describe('production hostname handling', () => {
		it('extracts subdomain from multi-part hostname', () => {
			expect(extractSubdomain('crede.polyphony.uk')).toBe('crede');
			expect(extractSubdomain('myorchestra.polyphony.example.com')).toBe('myorchestra');
		});

		it('returns dev fallback for single-part hostname', () => {
			expect(extractSubdomain('polyphony')).toBe('crede');
		});
	});

	describe('skip subdomains', () => {
		it('returns null for www subdomain', () => {
			expect(extractSubdomain('www.polyphony.uk')).toBeNull();
			expect(extractSubdomain('www.localhost')).toBeNull();
		});

		it('returns null for api subdomain', () => {
			expect(extractSubdomain('api.polyphony.uk')).toBeNull();
			expect(extractSubdomain('api.localhost')).toBeNull();
		});

		it('returns null for static subdomain', () => {
			expect(extractSubdomain('static.polyphony.uk')).toBeNull();
			expect(extractSubdomain('static.localhost')).toBeNull();
		});

		it('returns null for vault subdomain', () => {
			expect(extractSubdomain('vault.polyphony.uk')).toBeNull();
			expect(extractSubdomain('vault.localhost')).toBeNull();
		});
	});
});

describe('isPublicOrAuthRoute', () => {
	describe('public API routes (no org context needed)', () => {
		it('returns true for /api/public/ routes', () => {
			expect(isPublicOrAuthRoute('/api/public/organizations')).toBe(true);
			expect(isPublicOrAuthRoute('/api/public/scores/pd')).toBe(true);
			expect(isPublicOrAuthRoute('/api/public/subdomains/check/crede')).toBe(true);
		});

		it('returns true for /api/auth/ routes', () => {
			expect(isPublicOrAuthRoute('/api/auth/login')).toBe(true);
			expect(isPublicOrAuthRoute('/api/auth/callback')).toBe(true);
			expect(isPublicOrAuthRoute('/api/auth/logout')).toBe(true);
		});
	});

	describe('takedowns routes (temporarily exempt)', () => {
		it('returns true for /api/takedowns', () => {
			expect(isPublicOrAuthRoute('/api/takedowns')).toBe(true);
		});

		it('returns true for /api/takedowns/ subpaths', () => {
			expect(isPublicOrAuthRoute('/api/takedowns/abc123')).toBe(true);
		});

		it('returns false for routes that merely start with /api/takedowns', () => {
			expect(isPublicOrAuthRoute('/api/takedownsbulk')).toBe(false);
			expect(isPublicOrAuthRoute('/api/takedowns-archive')).toBe(false);
		});
	});

	describe('protected API routes (org context required)', () => {
		it('returns false for /api/members/', () => {
			expect(isPublicOrAuthRoute('/api/members/abc123')).toBe(false);
		});

		it('returns false for /api/events/', () => {
			expect(isPublicOrAuthRoute('/api/events')).toBe(false);
			expect(isPublicOrAuthRoute('/api/events/abc/works')).toBe(false);
		});

		it('returns false for /api/editions/', () => {
			expect(isPublicOrAuthRoute('/api/editions/abc')).toBe(false);
		});

		it('returns false for /api/settings/', () => {
			expect(isPublicOrAuthRoute('/api/settings')).toBe(false);
		});

		it('returns false for /api/works/', () => {
			expect(isPublicOrAuthRoute('/api/works')).toBe(false);
		});

		it('returns false for /api/voices/', () => {
			expect(isPublicOrAuthRoute('/api/voices')).toBe(false);
		});

		it('returns false for /api/sections/', () => {
			expect(isPublicOrAuthRoute('/api/sections')).toBe(false);
		});

		it('returns false for /api/participation/', () => {
			expect(isPublicOrAuthRoute('/api/participation')).toBe(false);
		});
	});

	describe('non-API routes', () => {
		it('returns false for page routes', () => {
			expect(isPublicOrAuthRoute('/members')).toBe(false);
			expect(isPublicOrAuthRoute('/events')).toBe(false);
			expect(isPublicOrAuthRoute('/login')).toBe(false);
			expect(isPublicOrAuthRoute('/')).toBe(false);
		});
	});
});
