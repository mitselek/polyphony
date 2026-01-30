// Tests for event programs (setlists) database operations
import { describe, it, expect, beforeEach } from 'vitest';
import {
	getEventProgram,
	addToProgram,
	removeFromProgram,
	reorderProgram
} from '$lib/server/db/programs';

// Mock D1 database
interface MockRow {
	[key: string]: string | number | null;
}

interface MockResult {
	results: any[];
	success: boolean;
	meta: { changes?: number };
}

function createMockDb(): D1Database {
	const storage = new Map<string, any[]>();
	const tables = ['event_programs'];

	// Initialize tables
	tables.forEach((table) => storage.set(table, []));

	return {
		prepare: (query: string) => {
			const boundValues: unknown[] = [];

			return {
				bind(...values: unknown[]) {
					boundValues.push(...values);
					return this;
				},
				async first<T = MockRow>(): Promise<T | null> {
					const results = await this.all<T>();
					return results.results[0] ?? null;
				},
				async all<T = MockRow>(): Promise<MockResult & { results: T[] }> {
					const lowerQuery = query.toLowerCase();

					// INSERT into event_programs
					if (lowerQuery.includes('insert into event_programs')) {
						const programs = storage.get('event_programs') ?? [];
						const [event_id, edition_id, position, notes] = boundValues;

						// Check for duplicate
						const exists = programs.some(
							(p) => p.event_id === event_id && p.edition_id === edition_id
						);
						if (exists) {
							throw new Error('UNIQUE constraint failed');
						}

						programs.push({
							event_id: event_id as string,
							edition_id: edition_id as string,
							position: position as number,
							notes: notes as string | null,
							added_at: new Date().toISOString()
						});
						storage.set('event_programs', programs);
						return { results: [] as T[], success: true, meta: { changes: 1 } };
					}

					// SELECT program for event
					if (lowerQuery.includes('select') && lowerQuery.includes('where event_id = ?')) {
						const programs = storage.get('event_programs') ?? [];
						const event_id = boundValues[0];
						const eventPrograms = programs
							.filter((p) => p.event_id === event_id)
							.sort((a, b) => (a.position as number) - (b.position as number));
						return { results: eventPrograms as T[], success: true, meta: {} };
					}

					// UPDATE position
					if (lowerQuery.includes('update event_programs') && lowerQuery.includes('position')) {
						const programs = storage.get('event_programs') ?? [];
						const [position, event_id, edition_id] = boundValues;
						const index = programs.findIndex(
							(p) => p.event_id === event_id && p.edition_id === edition_id
						);
						if (index >= 0) {
							programs[index].position = position as number;
							storage.set('event_programs', programs);
							return { results: [] as T[], success: true, meta: { changes: 1 } };
						}
						return { results: [] as T[], success: true, meta: { changes: 0 } };
					}

					// DELETE
					if (lowerQuery.includes('delete from event_programs')) {
						const programs = storage.get('event_programs') ?? [];
						const [event_id, edition_id] = boundValues;
						const filtered = programs.filter(
							(p) => !(p.event_id === event_id && p.edition_id === edition_id)
						);
						const changes = programs.length - filtered.length;
						storage.set('event_programs', filtered);
						return { results: [] as T[], success: true, meta: { changes } };
					}

					return { results: [] as T[], success: true, meta: {} };
				},
				async run(): Promise<MockResult> {
					const result = await this.all();
					return { results: [], success: result.success, meta: result.meta };
				}
			};
		},
		batch: async (statements: unknown[]) => {
			const results = await Promise.all(
				statements.map((stmt: any) => (stmt.run ? stmt.run() : Promise.resolve({})))
			);
			return results;
		},
		dump: async () => new ArrayBuffer(0),
		exec: async () => ({ count: 0, duration: 0 })
	} as unknown as D1Database;
}

describe('Event Programs', () => {
	let db: D1Database;
	const eventId = 'event-001';
	const editionIds = ['edition-001', 'edition-002', 'edition-003'];

	beforeEach(() => {
		db = createMockDb();
	});

	describe('getEventProgram', () => {
		it('returns editions in order', async () => {
			// Add editions in non-sequential order
			await addToProgram(db, eventId, editionIds[2], 2);
			await addToProgram(db, eventId, editionIds[0], 0);
			await addToProgram(db, eventId, editionIds[1], 1);

			const program = await getEventProgram(db, eventId);

			expect(program).toHaveLength(3);
			expect(program[0].edition_id).toBe(editionIds[0]);
			expect(program[1].edition_id).toBe(editionIds[1]);
			expect(program[2].edition_id).toBe(editionIds[2]);
		});
	});

	describe('addToProgram', () => {
		it('adds edition to program', async () => {
			const added = await addToProgram(db, eventId, editionIds[0], 0, 'Opening piece');

			expect(added).toBe(true);

			const program = await getEventProgram(db, eventId);
			expect(program).toHaveLength(1);
			expect(program[0].edition_id).toBe(editionIds[0]);
			expect(program[0].notes).toBe('Opening piece');
		});

		it('prevents duplicate edition in same event', async () => {
			await addToProgram(db, eventId, editionIds[0], 0);

			// Try to add same edition again
			await expect(addToProgram(db, eventId, editionIds[0], 1)).rejects.toThrow();
		});
	});

	describe('removeFromProgram', () => {
		it('removes edition from program', async () => {
			await addToProgram(db, eventId, editionIds[0], 0);
			await addToProgram(db, eventId, editionIds[1], 1);

			const removed = await removeFromProgram(db, eventId, editionIds[0]);
			expect(removed).toBe(true);

			const program = await getEventProgram(db, eventId);
			expect(program).toHaveLength(1);
			expect(program[0].edition_id).toBe(editionIds[1]);
		});
	});

	describe('reorderProgram', () => {
		it('updates positions for all editions', async () => {
			// Add editions in original order
			await addToProgram(db, eventId, editionIds[0], 0);
			await addToProgram(db, eventId, editionIds[1], 1);
			await addToProgram(db, eventId, editionIds[2], 2);

			// Reorder: reverse the order
			await reorderProgram(db, eventId, [editionIds[2], editionIds[1], editionIds[0]]);

			const program = await getEventProgram(db, eventId);
			expect(program[0].edition_id).toBe(editionIds[2]);
			expect(program[1].edition_id).toBe(editionIds[1]);
			expect(program[2].edition_id).toBe(editionIds[0]);
		});
	});
});
