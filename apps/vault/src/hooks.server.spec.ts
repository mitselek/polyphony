// Unit tests for subdomain extraction in hooks.server.ts
import { describe, it, expect } from 'vitest';
import { extractSubdomain } from './hooks.server';

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
	});
});
