// Tests for POST /api/participation endpoint
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '$lib/../routes/api/participation/+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock SvelteKit error/json functions
vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual('@sveltejs/kit');
	return {
		...actual,
		error: (status: number, message: string) => {
			const err = new Error(message);
			(err as any).status = status;
			throw err;
		},
		json: (data: any) =>
			new Response(JSON.stringify(data), {
				headers: { 'content-type': 'application/json' }
			})
	};
});

// Test data
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

interface MockMember {
	id: string;
	email_id: string;
	name: string;
	roles: string[];
}

interface MockEvent {
	id: string;
	title: string;
	starts_at: string;
}

interface MockParticipation {
	id: string;
	member_id: string;
	event_id: string;
	planned_status: string | null;
	actual_status: string | null;
	recorded_by: string | null;
}

interface MockDbOptions {
	members: MockMember[];
	events: MockEvent[];
	participation?: MockParticipation[];
}

// Handler for member lookups
function handleMemberLookup(members: MockMember[], memberId: string) {
	const member = members.find((m) => m.id === memberId);
	if (!member) return null;
	return {
		id: member.id,
		name: member.name,
		nickname: null,
		email_id: member.email_id,
		email_contact: null,
		invited_by: null,
		joined_at: new Date().toISOString()
	};
}

// Handler for participation lookups
function handleParticipationLookup(
	records: Map<string, MockParticipation>,
	memberId: string,
	eventId: string
) {
	const record = records.get(`${memberId}:${eventId}`);
	if (!record) return null;
	return {
		id: record.id,
		member_id: record.member_id,
		event_id: record.event_id,
		planned_status: record.planned_status,
		planned_at: null,
		planned_notes: null,
		actual_status: record.actual_status,
		recorded_at: null,
		recorded_by: record.recorded_by,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
}

// Create first() handler
function createFirstHandler(
	query: string,
	params: unknown[],
	options: MockDbOptions,
	records: Map<string, MockParticipation>
) {
	if (query.includes('FROM members WHERE id')) {
		return handleMemberLookup(options.members, params[0] as string);
	}
	if (query.includes('FROM events WHERE id')) {
		return options.events.find((e) => e.id === params[0]) || null;
	}
	if (query.includes('FROM participation') && query.includes('member_id')) {
		return handleParticipationLookup(records, params[0] as string, params[1] as string);
	}
	return null;
}

// Create all() handler
function createAllHandler(query: string, params: unknown[], options: MockDbOptions) {
	if (query.includes('FROM member_roles')) {
		const member = options.members.find((m) => m.id === params[0]);
		return { results: member ? member.roles.map((role) => ({ role })) : [] };
	}
	if (query.includes('FROM member_voices') || query.includes('FROM member_sections')) {
		return { results: [] };
	}
	return { results: [] };
}

// Create run() handler
function createRunHandler(
	query: string,
	params: unknown[],
	records: Map<string, MockParticipation>
) {
	if (query.includes('INSERT INTO participation')) {
		const [id, memberId, eventId, plannedStatus] = params as string[];
		records.set(`${memberId}:${eventId}`, {
			id,
			member_id: memberId,
			event_id: eventId,
			planned_status: plannedStatus ?? null,
			actual_status: null,
			recorded_by: null
		});
		return { success: true, meta: { changes: 1 } };
	}
	if (query.includes('UPDATE participation')) {
		return { success: true, meta: { changes: 1 } };
	}
	return { success: true, meta: { changes: 0 } };
}

// Mock database factory
function createMockDb(options: MockDbOptions) {
	const records = new Map<string, MockParticipation>();
	(options.participation ?? []).forEach((p) => records.set(`${p.member_id}:${p.event_id}`, p));

	return {
		prepare: (query: string) => {
			let params: unknown[] = [];
			const statement = {
				bind: (...args: unknown[]) => {
					params = args;
					return statement;
				},
				first: async () => createFirstHandler(query, params, options, records),
				all: async () => createAllHandler(query, params, options),
				run: async () => createRunHandler(query, params, records)
			};
			return statement as any;
		}
	};
}

// Helper to create mock request event
function createRequestEvent(
	db: any,
	memberId: string | null,
	body: Record<string, unknown>
): RequestEvent {
	return {
		platform: { env: { DB: db } },
		cookies: {
			get: (name: string) => (name === 'member_id' ? memberId : undefined),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn(),
			getAll: vi.fn()
		},
		request: {
			json: async () => body
		}
	} as unknown as RequestEvent;
}

describe('POST /api/participation', () => {
	const regularMember: MockMember = {
		id: 'member-1',
		email_id: 'member@example.com',
		name: 'Regular Member',
		roles: []
	};

	const conductorMember: MockMember = {
		id: 'conductor-1',
		email_id: 'conductor@example.com',
		name: 'Conductor',
		roles: ['conductor']
	};

	const sectionLeader: MockMember = {
		id: 'section-leader-1',
		email_id: 'leader@example.com',
		name: 'Section Leader',
		roles: ['section_leader']
	};

	const futureEvent: MockEvent = {
		id: 'event-future',
		title: 'Future Rehearsal',
		starts_at: futureDate
	};

	const pastEvent: MockEvent = {
		id: 'event-past',
		title: 'Past Rehearsal',
		starts_at: pastDate
	};

	describe('validation', () => {
		it('should return 400 if eventId is missing', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			await expect(POST(event)).rejects.toThrow('eventId and memberId are required');
		});

		it('should return 400 if memberId is missing', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: futureEvent.id,
				plannedStatus: 'yes'
			});

			await expect(POST(event)).rejects.toThrow('eventId and memberId are required');
		});

		it('should return 404 if event not found', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: []
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: 'non-existent',
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			await expect(POST(event)).rejects.toThrow('Event not found');
		});

		it('should return 400 for invalid planned status', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'invalid'
			});

			await expect(POST(event)).rejects.toThrow('Invalid planned status');
		});

		it('should return 400 for invalid actual status', async () => {
			const db = createMockDb({
				members: [conductorMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				actualStatus: 'invalid'
			});

			await expect(POST(event)).rejects.toThrow('Invalid actual status');
		});
	});

	describe('RSVP permissions', () => {
		it('should allow user to update their own future RSVP', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should deny regular user from updating their own past RSVP', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			await expect(POST(event)).rejects.toThrow('Cannot update RSVP');
		});

		it("should deny regular user from updating another member's RSVP", async () => {
			const otherMember: MockMember = {
				id: 'other-member',
				email_id: 'other@example.com',
				name: 'Other',
				roles: []
			};

			const db = createMockDb({
				members: [regularMember, otherMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: futureEvent.id,
				memberId: otherMember.id,
				plannedStatus: 'yes'
			});

			await expect(POST(event)).rejects.toThrow('Cannot update RSVP');
		});

		it("should allow conductor to update another member's future RSVP", async () => {
			const db = createMockDb({
				members: [conductorMember, regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it("should allow conductor to update another member's past RSVP", async () => {
			const db = createMockDb({
				members: [conductorMember, regularMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'yes'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it("should allow section leader to update another member's RSVP", async () => {
			const db = createMockDb({
				members: [sectionLeader, regularMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, sectionLeader.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				plannedStatus: 'maybe'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});

	describe('attendance permissions', () => {
		it('should deny recording attendance for future events', async () => {
			const db = createMockDb({
				members: [conductorMember],
				events: [futureEvent]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				actualStatus: 'present'
			});

			await expect(POST(event)).rejects.toThrow('Cannot record attendance for future events');
		});

		it('should deny regular user from recording attendance', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				actualStatus: 'present'
			});

			await expect(POST(event)).rejects.toThrow('Only conductors/section leaders');
		});

		it('should allow conductor to record attendance for past event', async () => {
			const db = createMockDb({
				members: [conductorMember, regularMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				actualStatus: 'present'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should allow section leader to record attendance', async () => {
			const db = createMockDb({
				members: [sectionLeader, regularMember],
				events: [pastEvent]
			});

			const event = createRequestEvent(db, sectionLeader.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				actualStatus: 'absent'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});

	describe('clearing status', () => {
		it('should allow clearing RSVP with null', async () => {
			const db = createMockDb({
				members: [regularMember],
				events: [futureEvent],
				participation: [
					{
						id: 'part-1',
						member_id: regularMember.id,
						event_id: futureEvent.id,
						planned_status: 'yes',
						actual_status: null,
						recorded_by: null
					}
				]
			});

			const event = createRequestEvent(db, regularMember.id, {
				eventId: futureEvent.id,
				memberId: regularMember.id,
				plannedStatus: null
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should allow conductor to clear attendance with null', async () => {
			const db = createMockDb({
				members: [conductorMember, regularMember],
				events: [pastEvent],
				participation: [
					{
						id: 'part-2',
						member_id: regularMember.id,
						event_id: pastEvent.id,
						planned_status: null,
						actual_status: 'present',
						recorded_by: conductorMember.id
					}
				]
			});

			const event = createRequestEvent(db, conductorMember.id, {
				eventId: pastEvent.id,
				memberId: regularMember.id,
				actualStatus: null
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});

	describe('valid status values', () => {
		it.each(['yes', 'no', 'maybe', 'late'] as const)(
			'should accept plannedStatus=%s',
			async (status) => {
				const db = createMockDb({
					members: [regularMember],
					events: [futureEvent]
				});

				const event = createRequestEvent(db, regularMember.id, {
					eventId: futureEvent.id,
					memberId: regularMember.id,
					plannedStatus: status
				});

				const response = await POST(event);
				expect(response.status).toBe(200);
			}
		);

		it.each(['present', 'absent', 'late'] as const)(
			'should accept actualStatus=%s',
			async (status) => {
				const db = createMockDb({
					members: [conductorMember, regularMember],
					events: [pastEvent]
				});

				const event = createRequestEvent(db, conductorMember.id, {
					eventId: pastEvent.id,
					memberId: regularMember.id,
					actualStatus: status
				});

				const response = await POST(event);
				expect(response.status).toBe(200);
			}
		);
	});
});
