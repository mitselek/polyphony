// sections.ts TDD test suite
import { describe, it, expect, beforeEach } from 'vitest';
import {
	getActiveSections,
	getAllSections,
	getSectionById,
	createSection,
	toggleSectionActive
} from './sections';
import type { CreateSectionInput, Section } from '$lib/types';

// Mock D1Database for testing
function createMockDB(): D1Database {
	const sections = new Map<string, any>();

	// Seed default sections (matching migration)
	sections.set('soprano', {
		id: 'soprano',
		name: 'Soprano',
		abbreviation: 'S',
		parent_section_id: null,
		display_order: 10,
		is_active: 1
	});
	sections.set('alto', {
		id: 'alto',
		name: 'Alto',
		abbreviation: 'A',
		parent_section_id: null,
		display_order: 20,
		is_active: 1
	});
	sections.set('tenor', {
		id: 'tenor',
		name: 'Tenor',
		abbreviation: 'T',
		parent_section_id: null,
		display_order: 30,
		is_active: 1
	});
	sections.set('soprano-1', {
		id: 'soprano-1',
		name: 'Soprano I',
		abbreviation: 'S1',
		parent_section_id: 'soprano',
		display_order: 11,
		is_active: 0
	});

	return {
		prepare: (sql: string) => {
			return {
				bind: (...params: any[]) => ({
					first: async () => {
						if (sql.includes('WHERE id = ?')) {
							return sections.get(params[0]) || null;
						}
						return null;
					},
					all: async () => {
						const results = Array.from(sections.values());
						if (sql.includes('WHERE is_active = 1')) {
							return { results: results.filter((s) => s.is_active === 1) };
						}
						return { results };
					},
					run: async () => {
						if (sql.includes('INSERT INTO sections')) {
							const [id, name, abbr, parentId, displayOrder, isActive] = params;
							sections.set(id, {
								id,
								name,
								abbreviation: abbr,
								parent_section_id: parentId,
								display_order: displayOrder,
								is_active: isActive ?? 1
							});
							return { success: true, meta: { changes: 1 } };
						}
						if (sql.includes('UPDATE sections SET is_active')) {
							const [isActive, id] = params;
							const section = sections.get(id);
							if (section) {
								section.is_active = isActive;
								return { success: true, meta: { changes: 1 } };
							}
							return { success: false, meta: { changes: 0 } };
						}
						return { success: false, meta: { changes: 0 } };
					}
				}),
				all: async () => {
					const results = Array.from(sections.values());
					if (sql.includes('WHERE is_active = 1')) {
						return { results: results.filter((s) => s.is_active === 1) };
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

describe('sections.ts', () => {
	let db: D1Database;

	beforeEach(() => {
		db = createMockDB();
	});

	describe('getActiveSections', () => {
		it('should return only active sections', async () => {
			const sections = await getActiveSections(db);
			expect(sections.length).toBe(3); // soprano, alto, tenor
			expect(sections.every((s: Section) => s.isActive)).toBe(true);
		});

		it('should return sections ordered by display_order', async () => {
			const sections = await getActiveSections(db);
			expect(sections[0].name).toBe('Soprano');
			expect(sections[1].name).toBe('Alto');
			expect(sections[2].name).toBe('Tenor');
		});
	});

	describe('getAllSections', () => {
		it('should return all sections including inactive', async () => {
			const sections = await getAllSections(db);
			expect(sections.length).toBeGreaterThanOrEqual(4); // soprano, alto, tenor, soprano-1
		});

		it('should include inactive sections', async () => {
			const sections = await getAllSections(db);
			const soprano1 = sections.find((s: Section) => s.id === 'soprano-1');
			expect(soprano1).toBeDefined();
			expect(soprano1!.isActive).toBe(false);
		});

		it('should include parent section id', async () => {
			const sections = await getAllSections(db);
			const soprano1 = sections.find((s: Section) => s.id === 'soprano-1');
			expect(soprano1!.parentSectionId).toBe('soprano');
		});
	});

	describe('getSectionById', () => {
		it('should return section by id', async () => {
			const section = await getSectionById(db, 'soprano');
			expect(section).toBeDefined();
			expect(section!.name).toBe('Soprano');
			expect(section!.abbreviation).toBe('S');
		});

		it('should return null for non-existent id', async () => {
			const section = await getSectionById(db, 'nonexistent');
			expect(section).toBeNull();
		});

		it('should convert snake_case to camelCase', async () => {
			const section = await getSectionById(db, 'soprano-1');
			expect(section).toHaveProperty('parentSectionId');
			expect(section).toHaveProperty('displayOrder');
			expect(section).toHaveProperty('isActive');
		});
	});

	describe('createSection', () => {
		it('should create a new section', async () => {
			const input: CreateSectionInput = {
				name: 'Mezzo-Soprano',
				abbreviation: 'MS',
				displayOrder: 15
			};

			const section = await createSection(db, input);
			expect(section.name).toBe('Mezzo-Soprano');
			expect(section.abbreviation).toBe('MS');
			expect(section.isActive).toBe(true);
		});

		it('should generate id from name', async () => {
			const input: CreateSectionInput = {
				name: 'Mezzo-Soprano',
				abbreviation: 'MS',
				displayOrder: 15
			};

			const section = await createSection(db, input);
			expect(section.id).toBe('mezzo-soprano');
		});

		it('should allow creating subsections with parent', async () => {
			const input: CreateSectionInput = {
				name: 'Soprano III',
				abbreviation: 'S3',
				parentSectionId: 'soprano',
				displayOrder: 13
			};

			const section = await createSection(db, input);
			expect(section.parentSectionId).toBe('soprano');
		});

		it('should allow creating inactive sections', async () => {
			const input: CreateSectionInput = {
				name: 'Counter-Tenor',
				abbreviation: 'CT',
				displayOrder: 25,
				isActive: false
			};

			const section = await createSection(db, input);
			expect(section.isActive).toBe(false);
		});
	});

	describe('toggleSectionActive', () => {
		it('should activate an inactive section', async () => {
			const result = await toggleSectionActive(db, 'soprano-1', true);
			expect(result).toBe(true);

			const section = await getSectionById(db, 'soprano-1');
			expect(section!.isActive).toBe(true);
		});

		it('should deactivate an active section', async () => {
			const result = await toggleSectionActive(db, 'soprano', false);
			expect(result).toBe(true);

			const section = await getSectionById(db, 'soprano');
			expect(section!.isActive).toBe(false);
		});

		it('should return false for non-existent section', async () => {
			const result = await toggleSectionActive(db, 'nonexistent', true);
			expect(result).toBe(false);
		});
	});
});
