// Programs API route tests
// Tests for /api/events/[id]/program endpoints
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { Member } from '$lib/server/db/members';
import type { ProgramEntry } from '$lib/server/db/programs';

// Mock the middleware
vi.mock('$lib/server/auth/middleware', () => ({
	getAuthenticatedMember: vi.fn()
}));

// Mock the permissions
vi.mock('$lib/server/auth/permissions', () => ({
	canManageEvents: vi.fn()
}));

// Mock the programs DB functions
vi.mock('$lib/server/db/programs', () => ({
	getEventProgram: vi.fn(),
	addToProgram: vi.fn(),
	removeFromProgram: vi.fn(),
	reorderProgram: vi.fn()
}));

import { GET, POST } from '../../../routes/api/events/[id]/program/+server';
import { DELETE } from '../../../routes/api/events/[id]/program/[edition_id]/+server';
import { POST as REORDER } from '../../../routes/api/events/[id]/program/reorder/+server';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';
import { canManageEvents } from '$lib/server/auth/permissions';
import { getEventProgram, addToProgram, removeFromProgram, reorderProgram } from '$lib/server/db/programs';

// Helper to create mock request event
function createMockEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
	return {
		platform: { env: { DB: {} as D1Database } },
		cookies: {
			get: vi.fn(),
			getAll: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn()
		},
		params: { id: 'event-1' },
		request: new Request('http://localhost/api/events/event-1/program'),
		url: new URL('http://localhost/api/events/event-1/program'),
		locals: {},
		route: { id: '/api/events/[id]/program' },
		getClientAddress: () => '127.0.0.1',
		fetch: vi.fn(),
		setHeaders: vi.fn(),
		isDataRequest: false,
		isSubRequest: false,
		...overrides
	} as unknown as RequestEvent;
}

// Mock member with conductor permission
const mockConductor: Member = {
	id: 'member-1',
	name: 'Conductor User',
	nickname: null,
	email_id: 'conductor@example.com',
	email_contact: null,
	roles: ['conductor'],
	voices: [],
	sections: [],
	invited_by: null,
	joined_at: '2024-01-01T00:00:00Z'
};

// Mock member without permission
const mockMember: Member = {
	id: 'member-2',
	name: 'Regular Member',
	nickname: null,
	email_id: 'member@example.com',
	email_contact: null,
	roles: [],
	voices: [],
	sections: [],
	invited_by: null,
	joined_at: '2024-01-01T00:00:00Z'
};

// Sample program data
const mockProgram: ProgramEntry[] = [
	{
		event_id: 'event-1',
		edition_id: 'edition-1',
		position: 1,
		notes: 'Opening piece',
		added_at: '2024-01-01T00:00:00Z'
	},
	{
		event_id: 'event-1',
		edition_id: 'edition-2',
		position: 2,
		notes: null,
		added_at: '2024-01-01T00:00:00Z'
	}
];

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getAuthenticatedMember).mockResolvedValue(mockConductor);
	vi.mocked(canManageEvents).mockReturnValue(true);
	vi.mocked(getEventProgram).mockResolvedValue(mockProgram);
	vi.mocked(addToProgram).mockResolvedValue(true);
	vi.mocked(removeFromProgram).mockResolvedValue(true);
	vi.mocked(reorderProgram).mockResolvedValue(undefined);
});

// ============================================================================
// GET /api/events/[id]/program
// ============================================================================

describe('GET /api/events/[id]/program', () => {
	it('returns event program for authenticated user', async () => {
		const event = createMockEvent();

		const response = await GET(event);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual(mockProgram);
		expect(getEventProgram).toHaveBeenCalledWith({}, 'event-1');
	});

	it('requires authentication', async () => {
		vi.mocked(getAuthenticatedMember).mockRejectedValue({ status: 401, body: { message: 'Unauthorized' } });
		const event = createMockEvent();

		await expect(GET(event)).rejects.toMatchObject({ status: 401 });
	});

	it('returns 400 if event ID is missing', async () => {
		const event = createMockEvent({ params: {} });

		await expect(GET(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns empty array for event with no program', async () => {
		vi.mocked(getEventProgram).mockResolvedValue([]);
		const event = createMockEvent();

		const response = await GET(event);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual([]);
	});
});

// ============================================================================
// POST /api/events/[id]/program
// ============================================================================

describe('POST /api/events/[id]/program', () => {
	it('adds edition to program with required fields', async () => {
		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					edition_id: 'edition-3',
					position: 3,
					notes: 'Closing piece'
				})
			})
		});

		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(addToProgram).toHaveBeenCalledWith({}, 'event-1', 'edition-3', 3, 'Closing piece');
		expect(getEventProgram).toHaveBeenCalledWith({}, 'event-1');
	});

	it('adds edition without notes', async () => {
		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					edition_id: 'edition-3',
					position: 3
				})
			})
		});

		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(addToProgram).toHaveBeenCalledWith({}, 'event-1', 'edition-3', 3, undefined);
	});

	it('requires conductor/admin permission', async () => {
		vi.mocked(getAuthenticatedMember).mockResolvedValue(mockMember);
		vi.mocked(canManageEvents).mockReturnValue(false);

		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: 'edition-3', position: 3 })
			})
		});

		await expect(POST(event)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 400 if edition_id is missing', async () => {
		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ position: 3 })
			})
		});

		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if position is missing', async () => {
		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: 'edition-3' })
			})
		});

		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if position is not a number', async () => {
		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: 'edition-3', position: 'first' })
			})
		});

		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if event ID is missing', async () => {
		const event = createMockEvent({
			params: {},
			request: new Request('http://localhost/api/events//program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: 'edition-3', position: 3 })
			})
		});

		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns updated program after adding edition', async () => {
		const updatedProgram: ProgramEntry[] = [...mockProgram, {
			event_id: 'event-1',
			edition_id: 'edition-3',
			position: 3,
			notes: null,
			added_at: '2024-01-01T00:00:00Z'
		}];
		vi.mocked(getEventProgram).mockResolvedValue(updatedProgram);

		const event = createMockEvent({
			request: new Request('http://localhost/api/events/event-1/program', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: 'edition-3', position: 3 })
			})
		});

		const response = await POST(event);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toHaveLength(3);
	});
});

// ============================================================================
// DELETE /api/events/[id]/program/[edition_id]
// ============================================================================

describe('DELETE /api/events/[id]/program/[edition_id]', () => {
	function createDeleteEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
		return {
			platform: { env: { DB: {} as D1Database } },
			cookies: {
				get: vi.fn(),
				getAll: vi.fn(),
				set: vi.fn(),
				delete: vi.fn(),
				serialize: vi.fn()
			},
			params: { id: 'event-1', edition_id: 'edition-1' },
			request: new Request('http://localhost/api/events/event-1/program/edition-1', { method: 'DELETE' }),
			url: new URL('http://localhost/api/events/event-1/program/edition-1'),
			locals: {},
			route: { id: '/api/events/[id]/program/[edition_id]' },
			getClientAddress: () => '127.0.0.1',
			fetch: vi.fn(),
			setHeaders: vi.fn(),
			isDataRequest: false,
			isSubRequest: false,
			...overrides
		} as unknown as RequestEvent;
	}

	it('removes edition from program', async () => {
		const event = createDeleteEvent();

		const response = await DELETE(event);

		expect(response.status).toBe(200);
		const data = await response.json() as { success: boolean };
		expect(data.success).toBe(true);
		expect(removeFromProgram).toHaveBeenCalledWith({}, 'event-1', 'edition-1');
	});

	it('requires conductor/admin permission', async () => {
		vi.mocked(getAuthenticatedMember).mockResolvedValue(mockMember);
		vi.mocked(canManageEvents).mockReturnValue(false);

		const event = createDeleteEvent();

		await expect(DELETE(event)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 404 if edition not in program', async () => {
		vi.mocked(removeFromProgram).mockResolvedValue(false);
		const event = createDeleteEvent();

		await expect(DELETE(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 400 if event ID is missing', async () => {
		const event = createDeleteEvent({ params: { edition_id: 'edition-1' } });

		await expect(DELETE(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if edition ID is missing', async () => {
		const event = createDeleteEvent({ params: { id: 'event-1' } });

		await expect(DELETE(event)).rejects.toMatchObject({ status: 400 });
	});
});

// ============================================================================
// POST /api/events/[id]/program/reorder
// ============================================================================

describe('POST /api/events/[id]/program/reorder', () => {
	function createReorderEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
		return {
			platform: { env: { DB: {} as D1Database } },
			cookies: {
				get: vi.fn(),
				getAll: vi.fn(),
				set: vi.fn(),
				delete: vi.fn(),
				serialize: vi.fn()
			},
			params: { id: 'event-1' },
			request: new Request('http://localhost/api/events/event-1/program/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_ids: ['edition-2', 'edition-1'] })
			}),
			url: new URL('http://localhost/api/events/event-1/program/reorder'),
			locals: {},
			route: { id: '/api/events/[id]/program/reorder' },
			getClientAddress: () => '127.0.0.1',
			fetch: vi.fn(),
			setHeaders: vi.fn(),
			isDataRequest: false,
			isSubRequest: false,
			...overrides
		} as unknown as RequestEvent;
	}

	it('reorders program editions', async () => {
		const event = createReorderEvent();

		const response = await REORDER(event);

		expect(response.status).toBe(200);
		const data = await response.json() as { success: boolean };
		expect(data.success).toBe(true);
		expect(reorderProgram).toHaveBeenCalledWith({}, 'event-1', ['edition-2', 'edition-1']);
	});

	it('requires conductor/admin permission', async () => {
		vi.mocked(getAuthenticatedMember).mockResolvedValue(mockMember);
		vi.mocked(canManageEvents).mockReturnValue(false);

		const event = createReorderEvent();

		await expect(REORDER(event)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 400 if edition_ids is missing', async () => {
		const event = createReorderEvent({
			request: new Request('http://localhost/api/events/event-1/program/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			})
		});

		await expect(REORDER(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if edition_ids is not an array', async () => {
		const event = createReorderEvent({
			request: new Request('http://localhost/api/events/event-1/program/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_ids: 'edition-1' })
			})
		});

		await expect(REORDER(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if edition_ids is empty array', async () => {
		const event = createReorderEvent({
			request: new Request('http://localhost/api/events/event-1/program/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_ids: [] })
			})
		});

		await expect(REORDER(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 if event ID is missing', async () => {
		const event = createReorderEvent({ params: {} });

		await expect(REORDER(event)).rejects.toMatchObject({ status: 400 });
	});
});
