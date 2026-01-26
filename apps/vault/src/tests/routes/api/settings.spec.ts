// Tests for /api/settings endpoint
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PATCH } from '$lib/../routes/api/settings/+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock SvelteKit error function
vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual('@sveltejs/kit');
	return {
		...actual,
		error: (status: number, message: string) => {
			const err = new Error(message);
			(err as any).status = status;
			throw err;
		}
	};
});

// Mock database
function createMockDb(membersData: Map<string, any> = new Map()) {
	const store = new Map<string, { value: string; updated_by: string | null; updated_at: string }>();

	// Pre-populate with default settings
	store.set('default_event_duration', { value: '120', updated_by: null, updated_at: new Date().toISOString() });
	store.set('conductor_id', { value: '', updated_by: null, updated_at: new Date().toISOString() });

	return {
		prepare: (query: string) => {
			const statement = {
				bind: (...params: unknown[]) => {
					statement._params = params;
					return statement;
				},
				first: async () => {
					if (query.includes('SELECT') && query.includes('WHERE key')) {
						const key = statement._params?.[0] as string;
						const row = store.get(key);
						return row ? { key, ...row } : null;
					}
					// Member lookup
					if (query.includes('FROM members WHERE id')) {
						const id = statement._params?.[0] as string;
						const memberData = membersData.get(id);
						if (!memberData) return null;
						// Return member without roles (roles come from separate query)
						return {
							id: memberData.id,
							email: memberData.email,
							name: memberData.name,
							voice_part: memberData.voice_part,
							invited_by: memberData.invited_by,
							joined_at: memberData.joined_at
						};
					}
					return null;
				},
				all: async () => {
					if (query.includes('SELECT') && query.includes('FROM vault_settings')) {
						const results = Array.from(store.entries()).map(([key, data]) => ({
							key,
							...data
						}));
						return { results };
					}
					// Member roles lookup
					if (query.includes('FROM member_roles')) {
						const memberId = statement._params?.[0] as string;
						const member = membersData.get(memberId);
						if (member) {
							const results = member.roles.map((role: string) => ({ role }));
							return { results };
						}
					}
					return { results: [] };
				},
				run: async () => {
					if (query.includes('INSERT') || query.includes('ON CONFLICT')) {
						const [key, value, updated_by] = statement._params as [string, string, string | undefined];
						store.set(key, {
							value,
							updated_by: updated_by ?? null,
							updated_at: new Date().toISOString()
						});
					}
					return { success: true };
				},
				_params: [] as unknown[]
			};
			return statement;
		}
	} as unknown as D1Database;
}

function createMockCookies(memberId: string | null = 'admin123'): any {
	return {
		get: (key: string) => {
			if (key === 'member_id') return memberId;
			return null;
		}
	};
}

function createMockEvent(overrides?: Partial<RequestEvent>): RequestEvent {
	const membersData = new Map();
	membersData.set('admin123', {
		id: 'admin123',
		email: 'admin@example.com',
		name: 'Admin User',
		roles: ['admin'],
		voice_part: null,
		invited_by: null,
		joined_at: new Date().toISOString()
	});
	membersData.set('member123', {
		id: 'member123',
		email: 'member@example.com',
		name: 'Regular Member',
		roles: [],
		voice_part: null,
		invited_by: null,
		joined_at: new Date().toISOString()
	});

	return {
		platform: {
			env: {
				DB: createMockDb(membersData)
			}
		},
		cookies: createMockCookies('admin123'),
		...overrides
	} as RequestEvent;
}

describe('GET /api/settings', () => {
	it('returns all settings for admin', async () => {
		const event = createMockEvent();
		const response = await GET(event);

		expect(response.status).toBe(200);
		const data = await response.json() as Record<string, string>;
		expect(data).toEqual({
			default_event_duration: '120',
			conductor_id: ''
		});
	});

	it('requires authentication', async () => {
		const event = createMockEvent({
			cookies: createMockCookies(null)
		});

		await expect(GET(event)).rejects.toThrow('Authentication required');
	});

	it('requires admin role', async () => {
		const event = createMockEvent({
			cookies: createMockCookies('member123')
		});

		await expect(GET(event)).rejects.toThrow('Admin or owner role required');
	});
});

describe('PATCH /api/settings', () => {
	it('updates settings for admin', async () => {
		const mockRequest = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				default_event_duration: 90
			})
		});

		const event = createMockEvent({ request: mockRequest });
		const response = await PATCH(event);

		expect(response.status).toBe(200);
		const data = await response.json() as Record<string, string>;
		expect(data.default_event_duration).toBe('90');
		expect(data.conductor_id).toBe('');
	});

	it('allows partial updates', async () => {
		const mockRequest = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				conductor_id: 'conductor123'
			})
		});

		const event = createMockEvent({ request: mockRequest });
		const response = await PATCH(event);

		expect(response.status).toBe(200);
		const data = await response.json() as Record<string, string>;
		expect(data.conductor_id).toBe('conductor123');
		expect(data.default_event_duration).toBe('120'); // Unchanged
	});

	// TODO Phase 3: Add test for default_voices validation once implemented

	it('validates event duration is positive integer', async () => {
		const mockRequest = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				default_event_duration: -30
			})
		});

		const event = createMockEvent({ request: mockRequest });

		await expect(PATCH(event)).rejects.toThrow();
	});

	it('requires admin role for updates', async () => {
		const mockRequest = new Request('http://localhost', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ conductor_id: 'test' })
		});

		const event = createMockEvent({
			request: mockRequest,
			cookies: createMockCookies('member123')
		});

		await expect(PATCH(event)).rejects.toThrow('Admin or owner role required');
	});
});
