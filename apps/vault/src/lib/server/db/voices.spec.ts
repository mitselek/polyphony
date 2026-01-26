// voices.ts TDD test suite
import { describe, it, expect, beforeEach } from 'vitest';
import {
	getActiveVoices,
	getAllVoices,
	getVoiceById,
	createVoice,
	toggleVoiceActive
} from './voices';
import type { CreateVoiceInput, Voice } from '$lib/types';

// Mock D1Database for testing
function createMockDB(): D1Database {
	const voices = new Map<string, any>();

	// Seed default voices (matching migration)
	voices.set('soprano', {
		id: 'soprano',
		name: 'Soprano',
		abbreviation: 'S',
		category: 'vocal',
		range_group: 'soprano',
		display_order: 10,
		is_active: 1
	});
	voices.set('alto', {
		id: 'alto',
		name: 'Alto',
		abbreviation: 'A',
		category: 'vocal',
		range_group: 'alto',
		display_order: 20,
		is_active: 1
	});
	voices.set('tenor', {
		id: 'tenor',
		name: 'Tenor',
		abbreviation: 'T',
		category: 'vocal',
		range_group: 'tenor',
		display_order: 30,
		is_active: 1
	});
	voices.set('soprano-1', {
		id: 'soprano-1',
		name: 'Soprano I',
		abbreviation: 'S1',
		category: 'vocal',
		range_group: 'soprano',
		display_order: 11,
		is_active: 0
	});

	return {
		prepare: (sql: string) => {
			return {
				bind: (...params: any[]) => ({
					first: async () => {
						if (sql.includes('WHERE id = ?')) {
							return voices.get(params[0]) || null;
						}
						return null;
					},
					all: async () => {
						const results = Array.from(voices.values());
						if (sql.includes('WHERE is_active = 1')) {
							return { results: results.filter((v) => v.is_active === 1) };
						}
						return { results };
					},
					run: async () => {
						if (sql.includes('INSERT INTO voices')) {
							const [id, name, abbr, category, rangeGroup, displayOrder, isActive] = params;
							voices.set(id, {
								id,
								name,
								abbreviation: abbr,
								category,
								range_group: rangeGroup,
								display_order: displayOrder,
								is_active: isActive ?? 1
							});
							return { success: true, meta: { changes: 1 } };
						}
						if (sql.includes('UPDATE voices SET is_active')) {
							const [isActive, id] = params;
							const voice = voices.get(id);
							if (voice) {
								voice.is_active = isActive;
								return { success: true, meta: { changes: 1 } };
							}
							return { success: false, meta: { changes: 0 } };
						}
						return { success: false, meta: { changes: 0 } };
					}
				}),
				all: async () => {
					const results = Array.from(voices.values());
					if (sql.includes('WHERE is_active = 1')) {
						return { results: results.filter((v) => v.is_active === 1) };
					}
					return { results };
				},
				first: async () => {
					return null;
				},
				run: async () => ({ success: false, meta: { changes: 0 } })
			};
		},
		dump: () => new ArrayBuffer(0),
		batch: () => Promise.resolve([]),
		exec: () => Promise.resolve({ count: 0, duration: 0 })
	} as unknown as D1Database;
}

describe('voices.ts', () => {
	let db: D1Database;

	beforeEach(() => {
		db = createMockDB();
	});

	describe('getActiveVoices', () => {
		it('should return only active voices', async () => {
			const voices = await getActiveVoices(db);
			expect(voices.length).toBe(3); // soprano, alto, tenor
			expect(voices.every((v: Voice) => v.isActive)).toBe(true);
		});

		it('should return voices ordered by display_order', async () => {
			const voices = await getActiveVoices(db);
			expect(voices[0].name).toBe('Soprano');
			expect(voices[1].name).toBe('Alto');
			expect(voices[2].name).toBe('Tenor');
		});
	});

	describe('getAllVoices', () => {
		it('should return all voices including inactive', async () => {
			const voices = await getAllVoices(db);
			expect(voices.length).toBeGreaterThanOrEqual(4); // soprano, alto, tenor, soprano-1
		});

		it('should include inactive voices', async () => {
			const voices = await getAllVoices(db);
			const soprano1 = voices.find((v: Voice) => v.id === 'soprano-1');
			expect(soprano1).toBeDefined();
			expect(soprano1!.isActive).toBe(false);
		});
	});

	describe('getVoiceById', () => {
		it('should return voice by id', async () => {
			const voice = await getVoiceById(db, 'soprano');
			expect(voice).toBeDefined();
			expect(voice!.name).toBe('Soprano');
			expect(voice!.abbreviation).toBe('S');
		});

		it('should return null for non-existent id', async () => {
			const voice = await getVoiceById(db, 'nonexistent');
			expect(voice).toBeNull();
		});

		it('should convert snake_case to camelCase', async () => {
			const voice = await getVoiceById(db, 'soprano');
			expect(voice).toHaveProperty('rangeGroup');
			expect(voice).toHaveProperty('displayOrder');
			expect(voice).toHaveProperty('isActive');
		});
	});

	describe('createVoice', () => {
		it('should create a new voice', async () => {
			const input: CreateVoiceInput = {
				name: 'Mezzo-Soprano',
				abbreviation: 'MS',
				category: 'vocal',
				rangeGroup: 'mezzo',
				displayOrder: 15
			};

			const voice = await createVoice(db, input);
			expect(voice.name).toBe('Mezzo-Soprano');
			expect(voice.abbreviation).toBe('MS');
			expect(voice.isActive).toBe(true);
		});

		it('should generate id from name', async () => {
			const input: CreateVoiceInput = {
				name: 'Mezzo-Soprano',
				abbreviation: 'MS',
				category: 'vocal',
				displayOrder: 15
			};

			const voice = await createVoice(db, input);
			expect(voice.id).toBe('mezzo-soprano');
		});

		it('should allow creating inactive voices', async () => {
			const input: CreateVoiceInput = {
				name: 'Counter-Tenor',
				abbreviation: 'CT',
				category: 'vocal',
				displayOrder: 25,
				isActive: false
			};

			const voice = await createVoice(db, input);
			expect(voice.isActive).toBe(false);
		});
	});

	describe('toggleVoiceActive', () => {
		it('should activate an inactive voice', async () => {
			const result = await toggleVoiceActive(db, 'soprano-1', true);
			expect(result).toBe(true);

			const voice = await getVoiceById(db, 'soprano-1');
			expect(voice!.isActive).toBe(true);
		});

		it('should deactivate an active voice', async () => {
			const result = await toggleVoiceActive(db, 'soprano', false);
			expect(result).toBe(true);

			const voice = await getVoiceById(db, 'soprano');
			expect(voice!.isActive).toBe(false);
		});

		it('should return false for non-existent voice', async () => {
			const result = await toggleVoiceActive(db, 'nonexistent', true);
			expect(result).toBe(false);
		});
	});
});
