// TDD: Tests for POST /copyright endpoint
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/copyright/+server';

// Mock the takedowns module
vi.mock('$lib/server/db/takedowns', () => ({
	createTakedownRequest: vi.fn()
}));

import { createTakedownRequest } from '$lib/server/db/takedowns';

function createMockRequest(body: unknown): Request {
	return new Request('http://localhost/copyright', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function createMockDb() {
	return {} as D1Database;
}

describe('POST /copyright', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 201 with takedown ID on valid request', async () => {
		const mockRequest = {
			score_id: 'score-123',
			claimant_name: 'John Doe',
			claimant_email: 'john@example.com',
			reason: 'This is my copyrighted work',
			attestation: true
		};

		vi.mocked(createTakedownRequest).mockResolvedValue({
			id: 'takedown-abc',
			score_id: 'score-123',
			claimant_name: 'John Doe',
			claimant_email: 'john@example.com',
			reason: 'This is my copyrighted work',
			attestation: true,
			status: 'pending',
			created_at: new Date().toISOString(),
			processed_at: null,
			processed_by: null,
			resolution_notes: null
		});

		const response = await POST({
			request: createMockRequest(mockRequest),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.id).toBe('takedown-abc');
		expect(data.message).toContain('received');
	});

	it('should return 400 when score_id is missing', async () => {
		const response = await POST({
			request: createMockRequest({
				claimant_name: 'John Doe',
				claimant_email: 'john@example.com',
				reason: 'Copyright claim',
				attestation: true
			}),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('score_id');
	});

	it('should return 400 when attestation is false', async () => {
		const response = await POST({
			request: createMockRequest({
				score_id: 'score-123',
				claimant_name: 'John Doe',
				claimant_email: 'john@example.com',
				reason: 'Copyright claim',
				attestation: false
			}),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('attestation');
	});

	it('should return 400 when email is invalid', async () => {
		const response = await POST({
			request: createMockRequest({
				score_id: 'score-123',
				claimant_name: 'John Doe',
				claimant_email: 'not-an-email',
				reason: 'Copyright claim',
				attestation: true
			}),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('email');
	});

	it('should return 404 when score does not exist', async () => {
		vi.mocked(createTakedownRequest).mockResolvedValue(null);

		const response = await POST({
			request: createMockRequest({
				score_id: 'nonexistent-score',
				claimant_name: 'John Doe',
				claimant_email: 'john@example.com',
				reason: 'Copyright claim',
				attestation: true
			}),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error.toLowerCase()).toContain('score');
	});

	it('should return 500 on database error', async () => {
		vi.mocked(createTakedownRequest).mockRejectedValue(new Error('DB error'));

		const response = await POST({
			request: createMockRequest({
				score_id: 'score-123',
				claimant_name: 'John Doe',
				claimant_email: 'john@example.com',
				reason: 'Copyright claim',
				attestation: true
			}),
			platform: { env: { DB: createMockDb() } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(500);
	});
});
