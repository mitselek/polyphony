// TDD: Tests for admin takedown API endpoints
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../routes/api/takedowns/+server';
import { POST as PROCESS } from '../../../routes/api/takedowns/[id]/process/+server';

// Mock the takedowns module
vi.mock('$lib/server/db/takedowns', () => ({
	listTakedownRequests: vi.fn(),
	processTakedown: vi.fn()
}));

// Mock the middleware
vi.mock('$lib/server/middleware', () => ({
	requireRole: vi.fn(() => () => Promise.resolve())
}));

// Mock the permissions
vi.mock('$lib/server/db/permissions', () => ({
	getMemberRole: vi.fn()
}));

import { listTakedownRequests, processTakedown } from '$lib/server/db/takedowns';
import { getMemberRole } from '$lib/server/db/permissions';

function createMockRequest(url: string = 'http://localhost/api/takedowns'): Request {
	return new Request(url, { method: 'GET' });
}

function createMockProcessRequest(body: unknown): Request {
	return new Request('http://localhost/api/takedowns/123/process', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function createMockDb() {
	return {} as D1Database;
}

function createMockCookies(memberId: string | null = 'admin-123') {
	return {
		get: vi.fn((name: string) => (name === 'member_id' ? memberId : null))
	};
}

describe('GET /api/takedowns', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 when not authenticated', async () => {
		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/takedowns'),
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies(null)
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(401);
	});

	it('should return 403 when user is not admin', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('singer');

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/takedowns'),
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('user-123')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(403);
	});

	it('should return all takedowns for admin', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('admin');
		vi.mocked(listTakedownRequests).mockResolvedValue([
			{
				id: 'takedown-1',
				score_id: 'score-1',
				claimant_name: 'Alice',
				claimant_email: 'alice@example.com',
				reason: 'Copyright violation',
				attestation: true,
				status: 'pending',
				created_at: '2025-01-01T00:00:00Z',
				processed_at: null,
				processed_by: null,
				resolution_notes: null
			}
		]);

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/takedowns'),
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('admin-123')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.takedowns).toHaveLength(1);
		expect(data.takedowns[0].id).toBe('takedown-1');
	});

	it('should filter by status when provided', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('owner');
		vi.mocked(listTakedownRequests).mockResolvedValue([]);

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/takedowns?status=pending'),
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('owner-123')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(listTakedownRequests).toHaveBeenCalledWith(expect.anything(), 'pending');
	});
});

describe('POST /api/takedowns/[id]/process', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 when not authenticated', async () => {
		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'approve' }),
			params: { id: 'takedown-123' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies(null)
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(401);
	});

	it('should return 403 when user is not admin', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('librarian');

		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'approve' }),
			params: { id: 'takedown-123' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('user-123')
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(403);
	});

	it('should approve takedown request', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('admin');
		vi.mocked(processTakedown).mockResolvedValue(true);

		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'approve', notes: 'Verified copyright claim' }),
			params: { id: 'takedown-123' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('admin-123')
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(200);
		expect(processTakedown).toHaveBeenCalledWith(
			expect.anything(),
			'takedown-123',
			'approved',
			'admin-123',
			'Verified copyright claim'
		);
	});

	it('should reject takedown request', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('owner');
		vi.mocked(processTakedown).mockResolvedValue(true);

		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'reject', notes: 'No valid claim' }),
			params: { id: 'takedown-456' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('owner-123')
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(200);
		expect(processTakedown).toHaveBeenCalledWith(
			expect.anything(),
			'takedown-456',
			'rejected',
			'owner-123',
			'No valid claim'
		);
	});

	it('should return 404 when takedown not found', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('admin');
		vi.mocked(processTakedown).mockResolvedValue(false);

		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'approve' }),
			params: { id: 'nonexistent' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('admin-123')
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(404);
	});

	it('should return 400 for invalid action', async () => {
		vi.mocked(getMemberRole).mockResolvedValue('admin');

		const response = await PROCESS({
			request: createMockProcessRequest({ action: 'invalid' }),
			params: { id: 'takedown-123' },
			platform: { env: { DB: createMockDb() } },
			cookies: createMockCookies('admin-123')
		} as unknown as Parameters<typeof PROCESS>[0]);

		expect(response.status).toBe(400);
	});
});
