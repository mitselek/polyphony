// Tests for editions database layer
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createEdition,
	getEditionById,
	getEditionsByWorkId,
	updateEdition,
	deleteEdition
} from './editions';
import type { CreateEditionInput, UpdateEditionInput } from '$lib/types';

// Mock D1Database
function createMockDb() {
	const mockResults: Record<string, unknown>[] = [];
	let lastInsertId = '';

	const mockStatement = {
		bind: vi.fn().mockReturnThis(),
		first: vi.fn().mockResolvedValue(null),
		all: vi.fn().mockResolvedValue({ results: mockResults }),
		run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
	};

	const mockDb = {
		prepare: vi.fn().mockReturnValue(mockStatement),
		batch: vi.fn().mockResolvedValue([]),
		_mockStatement: mockStatement,
		_setFirstResult: (result: unknown) => {
			mockStatement.first.mockResolvedValue(result);
		},
		_setAllResults: (results: unknown[]) => {
			mockStatement.all.mockResolvedValue({ results });
		},
		_setChanges: (changes: number) => {
			mockStatement.run.mockResolvedValue({ meta: { changes } });
		}
	};

	return mockDb as unknown as D1Database & {
		_mockStatement: typeof mockStatement;
		_setFirstResult: (result: unknown) => void;
		_setAllResults: (results: unknown[]) => void;
		_setChanges: (changes: number) => void;
	};
}

describe('Editions database layer', () => {
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		mockDb = createMockDb();
		vi.clearAllMocks();
	});

	describe('createEdition', () => {
		it('creates an edition with minimal fields', async () => {
			const input: CreateEditionInput = {
				workId: 'work-123',
				name: 'Novello Vocal Score'
			};

			const edition = await createEdition(mockDb, input);

			expect(edition.id).toBeDefined();
			expect(edition.workId).toBe('work-123');
			expect(edition.name).toBe('Novello Vocal Score');
			expect(edition.editionType).toBe('vocal_score');
			expect(edition.licenseType).toBe('owned');
			expect(edition.arranger).toBeNull();
		});

		it('creates an edition with all fields', async () => {
			const input: CreateEditionInput = {
				workId: 'work-123',
				name: 'CPDL Transcription',
				arranger: 'John Smith',
				publisher: 'CPDL',
				voicing: 'SATB div.',
				editionType: 'full_score',
				licenseType: 'public_domain',
				notes: 'High quality scan',
				externalUrl: 'https://imslp.org/example'
			};

			const edition = await createEdition(mockDb, input);

			expect(edition.name).toBe('CPDL Transcription');
			expect(edition.arranger).toBe('John Smith');
			expect(edition.publisher).toBe('CPDL');
			expect(edition.voicing).toBe('SATB div.');
			expect(edition.editionType).toBe('full_score');
			expect(edition.licenseType).toBe('public_domain');
			expect(edition.notes).toBe('High quality scan');
			expect(edition.externalUrl).toBe('https://imslp.org/example');
		});

		it('creates edition with section assignments', async () => {
			const input: CreateEditionInput = {
				workId: 'work-123',
				name: 'Soprano Part',
				editionType: 'part',
				sectionIds: ['section-s1', 'section-s2']
			};

			const edition = await createEdition(mockDb, input);

			expect(edition.name).toBe('Soprano Part');
			// Verify batch was called for section inserts
			expect(mockDb.batch).toHaveBeenCalled();
		});
	});

	describe('getEditionById', () => {
		it('returns edition when found', async () => {
			const editionRow = {
				id: 'ed-123',
				work_id: 'work-123',
				name: 'Test Edition',
				arranger: null,
				publisher: 'Test Publisher',
				voicing: 'SATB',
				edition_type: 'vocal_score',
				license_type: 'owned',
				notes: null,
				external_url: null,
				file_key: null,
				file_name: null,
				file_size: null,
				file_uploaded_at: null,
				file_uploaded_by: null,
				created_at: '2026-01-29T12:00:00Z'
			};

			mockDb._setFirstResult(editionRow);
			mockDb._setAllResults([]); // No sections

			const edition = await getEditionById(mockDb, 'ed-123');

			expect(edition).not.toBeNull();
			expect(edition?.id).toBe('ed-123');
			expect(edition?.workId).toBe('work-123');
			expect(edition?.name).toBe('Test Edition');
			expect(edition?.publisher).toBe('Test Publisher');
			expect(edition?.sectionIds).toEqual([]);
		});

		it('returns null when not found', async () => {
			mockDb._setFirstResult(null);

			const edition = await getEditionById(mockDb, 'nonexistent');

			expect(edition).toBeNull();
		});

		it('includes section IDs when present', async () => {
			const editionRow = {
				id: 'ed-123',
				work_id: 'work-123',
				name: 'Soprano Part',
				arranger: null,
				publisher: null,
				voicing: null,
				edition_type: 'part',
				license_type: 'owned',
				notes: null,
				external_url: null,
				file_key: null,
				file_name: null,
				file_size: null,
				file_uploaded_at: null,
				file_uploaded_by: null,
				created_at: '2026-01-29T12:00:00Z'
			};

			mockDb._setFirstResult(editionRow);
			mockDb._setAllResults([{ section_id: 'sec-s1' }, { section_id: 'sec-s2' }]);

			const edition = await getEditionById(mockDb, 'ed-123');

			expect(edition?.sectionIds).toEqual(['sec-s1', 'sec-s2']);
		});
	});

	describe('getEditionsByWorkId', () => {
		it('returns all editions for a work', async () => {
			const editions = [
				{
					id: 'ed-1',
					work_id: 'work-123',
					name: 'Full Score',
					arranger: null,
					publisher: null,
					voicing: 'SATB',
					edition_type: 'full_score',
					license_type: 'owned',
					notes: null,
					external_url: null,
					file_key: null,
					file_name: null,
					file_size: null,
					file_uploaded_at: null,
					file_uploaded_by: null,
					created_at: '2026-01-29T12:00:00Z'
				},
				{
					id: 'ed-2',
					work_id: 'work-123',
					name: 'Vocal Score',
					arranger: 'Smith',
					publisher: 'Publisher',
					voicing: 'SATB',
					edition_type: 'vocal_score',
					license_type: 'public_domain',
					notes: null,
					external_url: null,
					file_key: null,
					file_name: null,
					file_size: null,
					file_uploaded_at: null,
					file_uploaded_by: null,
					created_at: '2026-01-29T13:00:00Z'
				}
			];

			mockDb._setAllResults(editions);

			const result = await getEditionsByWorkId(mockDb, 'work-123');

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('Full Score');
			expect(result[1].name).toBe('Vocal Score');
		});

		it('returns empty array when no editions', async () => {
			mockDb._setAllResults([]);

			const result = await getEditionsByWorkId(mockDb, 'work-no-editions');

			expect(result).toEqual([]);
		});
	});

	describe('updateEdition', () => {
		it('updates edition fields', async () => {
			const updatedRow = {
				id: 'ed-123',
				work_id: 'work-123',
				name: 'New Name',
				arranger: null,
				publisher: 'New Publisher',
				voicing: null,
				edition_type: 'vocal_score',
				license_type: 'owned',
				notes: null,
				external_url: null,
				file_key: null,
				file_name: null,
				file_size: null,
				file_uploaded_at: null,
				file_uploaded_by: null,
				created_at: '2026-01-29T12:00:00Z'
			};

			// getEditionById is called after update - return updated row
			mockDb._setFirstResult(updatedRow);
			mockDb._setAllResults([]); // No sections

			const input: UpdateEditionInput = {
				name: 'New Name',
				publisher: 'New Publisher'
			};

			const edition = await updateEdition(mockDb, 'ed-123', input);

			expect(edition?.name).toBe('New Name');
			expect(edition?.publisher).toBe('New Publisher');
		});

		it('returns null when edition not found', async () => {
			mockDb._setChanges(0);

			const edition = await updateEdition(mockDb, 'nonexistent', { name: 'Test' });

			expect(edition).toBeNull();
		});

		it('clears optional fields when set to null', async () => {
			const updatedRow = {
				id: 'ed-123',
				work_id: 'work-123',
				name: 'Test',
				arranger: null,
				publisher: 'Old Publisher',
				voicing: 'SATB',
				edition_type: 'vocal_score',
				license_type: 'owned',
				notes: null,
				external_url: null,
				file_key: null,
				file_name: null,
				file_size: null,
				file_uploaded_at: null,
				file_uploaded_by: null,
				created_at: '2026-01-29T12:00:00Z'
			};

			mockDb._setFirstResult(updatedRow);
			mockDb._setAllResults([]);

			const edition = await updateEdition(mockDb, 'ed-123', {
				arranger: null,
				notes: null
			});

			expect(edition?.arranger).toBeNull();
			expect(edition?.notes).toBeNull();
		});
	});

	describe('deleteEdition', () => {
		it('deletes existing edition', async () => {
			mockDb._setChanges(1);

			const result = await deleteEdition(mockDb, 'ed-123');

			expect(result).toBe(true);
		});

		it('returns false when edition not found', async () => {
			mockDb._setChanges(0);

			const result = await deleteEdition(mockDb, 'nonexistent');

			expect(result).toBe(false);
		});
	});
});
