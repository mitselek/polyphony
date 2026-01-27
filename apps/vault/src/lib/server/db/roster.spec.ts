import { describe, it, expect, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { getRosterView } from './roster';
import type { RosterViewFilters } from '$lib/types';

// Mock D1Database for testing
function createMockDB(): D1Database & { __mockState: any } {
	// Use a shared state object that both the SQL handlers and seedData can reference
	const mockState = {
		events: new Map<string, any>(),
		members: new Map<string, any>(),
		participation: new Map<string, any>(),
		sections: new Map<string, any>(),
		voices: new Map<string, any>(),
		memberSections: new Map<string, any[]>(),
		memberVoices: new Map<string, any[]>()
	};

	const db = {
		prepare: (sql: string) => {
			return {
				bind: (...params: any[]) => ({
					first: async () => null,
					all: async () => {
						// Events query (with date filtering)
						if (sql.includes('SELECT * FROM events') || sql.includes('FROM events WHERE')) {
							let results = Array.from(mockState.events.values());

							// Apply date filters
							if (sql.includes('date >= ?') && sql.includes('date <= ?')) {
								const [start, end] = params;
								results = results.filter(
									(e) => e.date >= start && e.date <= end
								);
							} else if (sql.includes('date >= ?')) {
								const [start] = params;
								results = results.filter((e) => e.date >= start);
							} else if (sql.includes('date <= ?')) {
								const [end] = params;
								results = results.filter((e) => e.date <= end);
							}

							// Sort by date DESC
							results.sort((a, b) => b.date.localeCompare(a.date));

							return { results };
						}

						// Members query (with section filtering)
						if (sql.includes('SELECT DISTINCT m.*') || sql.includes('SELECT * FROM members')) {
							let results = Array.from(mockState.members.values());

							// Apply section filter via join
							if (sql.includes('JOIN member_sections') && params.length > 0) {
								const [sectionId] = params;
								const membersInSection = Array.from(mockState.memberSections.entries())
									.filter(([_, secs]) => secs.some((s) => s.section_id === sectionId))
									.map(([memberId]) => memberId);
								results = results.filter((m) => membersInSection.includes(m.id));
							}

							// Sort by name ASC
							results.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

							return { results };
						}

						// Participation query
						if (sql.includes('SELECT * FROM participation')) {
							return { results: Array.from(mockState.participation.values()) };
						}

						// Sections query
						if (sql.includes('SELECT * FROM sections')) {
							return { results: Array.from(mockState.sections.values()) };
						}

						// Voices query
						if (sql.includes('SELECT * FROM voices')) {
							return { results: Array.from(mockState.voices.values()) };
						}

						// Member sections query
						if (sql.includes('FROM member_sections WHERE member_id = ?')) {
							const [memberId] = params;
							const memberSecs = mockState.memberSections.get(memberId) || [];
							return { results: memberSecs };
						}

						// Member voices query
						if (sql.includes('FROM member_voices WHERE member_id = ?')) {
							const [memberId] = params;
							const memberVcs = mockState.memberVoices.get(memberId) || [];
							return { results: memberVcs };
						}

						return { results: [] };
					},
					run: async () => ({ success: false, meta: { changes: 0 } })
				}),
				// Also support .all() without .bind() for queries without parameters
				all: async () => {
					// Participation query
					if (sql.includes('SELECT * FROM participation')) {
						return { results: Array.from(mockState.participation.values()) };
					}

					// Sections query
					if (sql.includes('SELECT * FROM sections')) {
						return { results: Array.from(mockState.sections.values()) };
					}

					// Voices query
					if (sql.includes('SELECT * FROM voices')) {
						return { results: Array.from(mockState.voices.values()) };
					}

					return { results: [] };
				},
				first: async () => null,
				run: async () => ({ success: false, meta: { changes: 0 } })
			};
		},
		dump: () => new ArrayBuffer(0),
		batch: () => Promise.resolve([]),
		exec: () => Promise.resolve({ count: 0, duration: 0 }),
		__mockState: mockState
	} as unknown as D1Database & { __mockState: any };

	return db;
}

// Helper to seed test data
function seedData(db: any, data: {
	events?: any[];
	members?: any[];
	participation?: any[];
	sections?: any[];
	voices?: any[];
	memberSections?: { memberId: string; sections: any[] }[];
	memberVoices?: { memberId: string; voices: any[] }[];
}) {
	const mockState = db.__mockState;

	data.events?.forEach((e) => mockState.events.set(e.id, e));
	data.members?.forEach((m) => mockState.members.set(m.id, m));
	data.participation?.forEach((p) => {
		// Store by ID (or generate one if not provided)
		const key = p.id || `${p.member_id}_${p.event_id}`;
		mockState.participation.set(key, p);
	});
	data.sections?.forEach((s) => mockState.sections.set(s.id, s));
	data.voices?.forEach((v) => mockState.voices.set(v.id, v));
	data.memberSections?.forEach(({ memberId, sections }) =>
		mockState.memberSections.set(memberId, sections)
	);
	data.memberVoices?.forEach(({ memberId, voices }) =>
		mockState.memberVoices.set(memberId, voices)
	);
}

let mockDb: D1Database;

describe('Roster View Database Functions', () => {
	beforeEach(() => {
		mockDb = createMockDB();
	});

	describe('getRosterView', () => {
		it('should return empty arrays and zero summary with no data', async () => {
			const result = await getRosterView(mockDb);

			expect(result.events).toEqual([]);
			expect(result.members).toEqual([]);
			expect(result.summary.totalEvents).toBe(0);
			expect(result.summary.totalMembers).toBe(0);
			expect(result.summary.averageAttendance).toBe(0);
		});

		it('should list event with no members', async () => {
			seedData(mockDb, {
				events: [{ id: 'evt_1', name: 'Rehearsal 1', date: '2026-02-01', type: 'rehearsal' }]
			});

			const result = await getRosterView(mockDb);

			expect(result.events.length).toBe(1);
			expect(result.events[0].name).toBe('Rehearsal 1');
			expect(result.members).toEqual([]);
		});

		it('should list member with no events', async () => {
			seedData(mockDb, {
				members: [{ id: 'mem_1', email: 'test@example.com', name: 'Test User' }]
			});

			const result = await getRosterView(mockDb);

			expect(result.members.length).toBe(1);
			expect(result.members[0].name).toBe('Test User');
			expect(result.events).toEqual([]);
		});

		it('should show event and member with no participation', async () => {
			seedData(mockDb, {
				events: [{ id: 'evt_1', name: 'Rehearsal 1', date: '2026-02-01', type: 'rehearsal' }],
				members: [{ id: 'mem_1', email: 'test@example.com', name: 'Test User' }]
			});

			const result = await getRosterView(mockDb);

			expect(result.events.length).toBe(1);
			expect(result.members.length).toBe(1);
			expect(result.events[0].participation.get('mem_1')).toBeUndefined();
		});

		it('should show planned participation without actual status', async () => {
			seedData(mockDb, {
				events: [{ id: 'evt_1', name: 'Rehearsal 1', date: '2026-02-01', type: 'rehearsal' }],
				members: [{ id: 'mem_1', email: 'test@example.com', name: 'Test User' }],
				participation: [
					{
						id: 'part_1',
						member_id: 'mem_1',
						event_id: 'evt_1',
						planned_status: 'yes',
						actual_status: null,
						recorded_at: null
					}
				]
			});

			const result = await getRosterView(mockDb);

			const status = result.events[0].participation.get('mem_1');
			expect(status?.plannedStatus).toBe('yes');
			expect(status?.actualStatus).toBeNull();
		});

		it('should show both planned and actual attendance', async () => {
			seedData(mockDb, {
				events: [{ id: 'evt_1', name: 'Rehearsal 1', date: '2026-02-01', type: 'rehearsal' }],
				members: [{ id: 'mem_1', email: 'test@example.com', name: 'Test User' }],
				participation: [
					{
						id: 'part_1',
						member_id: 'mem_1',
						event_id: 'evt_1',
						planned_status: 'yes',
						actual_status: 'present',
						recorded_at: '2026-02-01T10:00:00Z'
					}
				]
			});

			const result = await getRosterView(mockDb);

			const status = result.events[0].participation.get('mem_1');
			expect(status?.plannedStatus).toBe('yes');
			expect(status?.actualStatus).toBe('present');
			expect(status?.recordedAt).toBe('2026-02-01T10:00:00Z');
		});

		it('should sort multiple events by date DESC (newest first)', async () => {
			seedData(mockDb, {
				events: [
					{ id: 'evt_1', name: 'Event 1', date: '2026-01-15', type: 'rehearsal' },
					{ id: 'evt_2', name: 'Event 2', date: '2026-02-20', type: 'concert' },
					{ id: 'evt_3', name: 'Event 3', date: '2026-01-30', type: 'rehearsal' }
				]
			});

			const result = await getRosterView(mockDb);

			expect(result.events[0].date).toBe('2026-02-20');
			expect(result.events[1].date).toBe('2026-01-30');
			expect(result.events[2].date).toBe('2026-01-15');
		});

		it('should sort multiple members by name ASC (alphabetical)', async () => {
			seedData(mockDb, {
				members: [
					{ id: 'mem_1', email: 'charlie@example.com', name: 'Charlie' },
					{ id: 'mem_2', email: 'alice@example.com', name: 'Alice' },
					{ id: 'mem_3', email: 'bob@example.com', name: 'Bob' }
				]
			});

			const result = await getRosterView(mockDb);

			expect(result.members[0].name).toBe('Alice');
			expect(result.members[1].name).toBe('Bob');
			expect(result.members[2].name).toBe('Charlie');
		});

		it('should filter events by startDate', async () => {
			seedData(mockDb, {
				events: [
					{ id: 'evt_1', name: 'Event 1', date: '2026-01-15', type: 'rehearsal' },
					{ id: 'evt_2', name: 'Event 2', date: '2026-02-20', type: 'concert' },
					{ id: 'evt_3', name: 'Event 3', date: '2026-03-10', type: 'rehearsal' }
				]
			});

			const filters: RosterViewFilters = { startDate: '2026-02-01' };
			const result = await getRosterView(mockDb, filters);

			expect(result.events.length).toBe(2);
			expect(result.events.every((e) => e.date >= '2026-02-01')).toBe(true);
		});

		it('should filter events by endDate', async () => {
			seedData(mockDb, {
				events: [
					{ id: 'evt_1', name: 'Event 1', date: '2026-01-15', type: 'rehearsal' },
					{ id: 'evt_2', name: 'Event 2', date: '2026-02-20', type: 'concert' },
					{ id: 'evt_3', name: 'Event 3', date: '2026-03-10', type: 'rehearsal' }
				]
			});

			const filters: RosterViewFilters = { endDate: '2026-02-28' };
			const result = await getRosterView(mockDb, filters);

			expect(result.events.length).toBe(2);
			expect(result.events.every((e) => e.date <= '2026-02-28')).toBe(true);
		});

		it('should filter events by date range (both startDate and endDate)', async () => {
			seedData(mockDb, {
				events: [
					{ id: 'evt_1', name: 'Event 1', date: '2026-01-15', type: 'rehearsal' },
					{ id: 'evt_2', name: 'Event 2', date: '2026-02-20', type: 'concert' },
					{ id: 'evt_3', name: 'Event 3', date: '2026-03-10', type: 'rehearsal' }
				]
			});

			const filters: RosterViewFilters = {
				startDate: '2026-02-01',
				endDate: '2026-02-28'
			};
			const result = await getRosterView(mockDb, filters);

			expect(result.events.length).toBe(1);
			expect(result.events[0].date).toBe('2026-02-20');
		});

		it('should filter members by section', async () => {
			const section = { id: 'sec_soprano', name: 'Soprano', abbreviation: 'S' };

			seedData(mockDb, {
				members: [
					{ id: 'mem_1', email: 'alice@example.com', name: 'Alice' },
					{ id: 'mem_2', email: 'bob@example.com', name: 'Bob' },
					{ id: 'mem_3', email: 'charlie@example.com', name: 'Charlie' }
				],
				sections: [section],
				memberSections: [
					{
						memberId: 'mem_1',
						sections: [{ section_id: 'sec_soprano', is_primary: 1 }]
					},
					{
						memberId: 'mem_3',
						sections: [{ section_id: 'sec_soprano', is_primary: 1 }]
					}
				]
			});

			const filters: RosterViewFilters = { sectionId: 'sec_soprano' };
			const result = await getRosterView(mockDb, filters);

			expect(result.members.length).toBe(2);
			expect(result.members.map((m) => m.name)).toContain('Alice');
			expect(result.members.map((m) => m.name)).toContain('Charlie');
			expect(result.members.map((m) => m.name)).not.toContain('Bob');
		});

		it('should calculate summary statistics correctly', async () => {
			seedData(mockDb, {
				events: [
					{ id: 'evt_1', name: 'Event 1', date: '2026-02-01', type: 'rehearsal' },
					{ id: 'evt_2', name: 'Event 2', date: '2026-02-15', type: 'rehearsal' }
				],
				members: [
					{ id: 'mem_1', email: 'alice@example.com', name: 'Alice' },
					{ id: 'mem_2', email: 'bob@example.com', name: 'Bob' }
				],
				participation: [
					{
						id: 'part_1',
						member_id: 'mem_1',
						event_id: 'evt_1',
						planned_status: 'yes',
						actual_status: 'present',
						recorded_at: '2026-02-01T10:00:00Z'
					},
					{
						id: 'part_2',
						member_id: 'mem_2',
						event_id: 'evt_1',
						planned_status: 'yes',
						actual_status: 'present',
						recorded_at: '2026-02-01T10:00:00Z'
					},
					{
						id: 'part_3',
						member_id: 'mem_1',
						event_id: 'evt_2',
						planned_status: 'yes',
						actual_status: 'absent',
						recorded_at: '2026-02-15T10:00:00Z'
					},
					{
						id: 'part_4',
						member_id: 'mem_2',
						event_id: 'evt_2',
						planned_status: 'yes',
						actual_status: 'absent',
						recorded_at: '2026-02-15T10:00:00Z'
					}
				]
			});

			const result = await getRosterView(mockDb);

			expect(result.summary.totalEvents).toBe(2);
			expect(result.summary.totalMembers).toBe(2);
			// 2 present out of 4 possible (2 events × 2 members) = 50%
			expect(result.summary.averageAttendance).toBe(50);
		});
	});
});
