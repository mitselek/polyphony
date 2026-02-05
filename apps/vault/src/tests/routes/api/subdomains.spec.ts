// Tests for subdomain availability check API
// TDD: Write tests first, then implement

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../routes/api/subdomains/check/+server';

// Response types for type safety
interface ErrorResponse {
	error: string;
}

interface AvailabilityResponse {
	available: boolean;
	reason?: 'taken' | 'reserved';
}

// Mock database
function createMockDb(existingSubdomains: string[] = []) {
	return {
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn().mockImplementation(async () => {
			// Check if the bound subdomain exists
			const boundSubdomain = (createMockDb as any).lastBoundValue;
			if (existingSubdomains.includes(boundSubdomain)) {
				return { id: 'org_123', subdomain: boundSubdomain };
			}
			return null;
		})
	};
}

function createMockRequest(subdomain: string | null) {
	const url = new URL('http://localhost/api/subdomains/check');
	if (subdomain !== null) {
		url.searchParams.set('name', subdomain);
	}
	return {
		url,
		platform: { env: { DB: createMockDb(['crede', 'kammerkoor', 'existing-choir']) } }
	};
}

describe('GET /api/subdomains/check', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('validation', () => {
		it('returns 400 if name parameter is missing', async () => {
			const mockRequest = createMockRequest(null);
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toBe('Missing name parameter');
		});

		it('returns 400 if name is too short (< 3 chars)', async () => {
			const mockRequest = createMockRequest('ab');
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toContain('3');
		});

		it('returns 400 if name is too long (> 30 chars)', async () => {
			const mockRequest = createMockRequest('a'.repeat(31));
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toContain('30');
		});

		it('returns 400 if name contains invalid characters', async () => {
			const mockRequest = createMockRequest('my_choir');
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toContain('invalid');
		});

		it('returns 400 if name starts with hyphen', async () => {
			const mockRequest = createMockRequest('-mychoir');
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toContain('hyphen');
		});

		it('returns 400 if name ends with hyphen', async () => {
			const mockRequest = createMockRequest('mychoir-');
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(400);
			const body = await response.json() as ErrorResponse;
			expect(body.error).toContain('hyphen');
		});
	});

	describe('availability check', () => {
		it('returns available: true for unused subdomain', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=newchoir'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(true);
		});

		it('returns available: false for taken subdomain', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ id: 'org_123', subdomain: 'crede' })
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=crede'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(false);
			expect(body.reason).toBe('taken');
		});

		it('normalizes input to lowercase', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=MyChoir'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			expect(db.bind).toHaveBeenCalledWith('mychoir');
		});

		it('accepts valid subdomain with hyphens', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=my-choir-name'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(true);
		});

		it('accepts valid subdomain with numbers', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=choir2025'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(true);
		});
	});

	describe('reserved subdomains', () => {
		it('returns available: false for reserved subdomain "www"', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null) // Not in DB but reserved
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=www'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(false);
			expect(body.reason).toBe('reserved');
		});

		it('returns available: false for reserved subdomain "api"', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=api'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(false);
			expect(body.reason).toBe('reserved');
		});

		it('returns available: false for reserved subdomain "admin"', async () => {
			const db = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};
			
			const mockRequest = {
				url: new URL('http://localhost/api/subdomains/check?name=admin'),
				platform: { env: { DB: db } }
			};
			
			const response = await GET(mockRequest as any);
			
			expect(response.status).toBe(200);
			const body = await response.json() as AvailabilityResponse;
			expect(body.available).toBe(false);
			expect(body.reason).toBe('reserved');
		});
	});
});
