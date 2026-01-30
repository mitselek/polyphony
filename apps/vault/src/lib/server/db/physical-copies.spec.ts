// Physical copies database layer tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createPhysicalCopy,
	batchCreatePhysicalCopies,
	getPhysicalCopyById,
	getPhysicalCopiesByEdition,
	updatePhysicalCopy,
	deletePhysicalCopy,
	copyNumberExists,
	getCopyStats
} from './physical-copies';

// Mock D1Database
function createMockDb() {
	const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
	const mockFirst = vi.fn();
	const mockAll = vi.fn().mockResolvedValue({ results: [] });
	const mockBind = vi.fn().mockReturnThis();
	const mockBatch = vi.fn().mockResolvedValue([]);

	return {
		prepare: vi.fn().mockReturnValue({
			bind: mockBind,
			run: mockRun,
			first: mockFirst,
			all: mockAll
		}),
		batch: mockBatch,
		_mocks: { mockRun, mockFirst, mockAll, mockBind, mockBatch }
	} as unknown as D1Database & { _mocks: typeof import('vitest') };
}

describe('Physical copies database layer', () => {
	let db: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		db = createMockDb();
	});

	describe('createPhysicalCopy', () => {
		it('creates a copy with required fields', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'good',
				acquired_at: null,
				notes: null,
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const copy = await createPhysicalCopy(db, {
				editionId: 'edition-1',
				copyNumber: '01'
			});

			expect(copy.editionId).toBe('edition-1');
			expect(copy.copyNumber).toBe('01');
			expect(copy.condition).toBe('good');
		});

		it('creates a copy with all fields', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: 'A-01',
				condition: 'fair',
				acquired_at: '2025-06-15',
				notes: 'Slightly worn cover',
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const copy = await createPhysicalCopy(db, {
				editionId: 'edition-1',
				copyNumber: 'A-01',
				condition: 'fair',
				acquiredAt: '2025-06-15',
				notes: 'Slightly worn cover'
			});

			expect(copy.condition).toBe('fair');
			expect(copy.acquiredAt).toBe('2025-06-15');
			expect(copy.notes).toBe('Slightly worn cover');
		});
	});

	describe('batchCreatePhysicalCopies', () => {
		it('creates numbered copies with zero-padding', async () => {
			const mockResults = [
				{ id: 'c1', edition_id: 'ed-1', copy_number: '01', condition: 'good', acquired_at: null, notes: null, created_at: '' },
				{ id: 'c2', edition_id: 'ed-1', copy_number: '02', condition: 'good', acquired_at: null, notes: null, created_at: '' },
				{ id: 'c3', edition_id: 'ed-1', copy_number: '03', condition: 'good', acquired_at: null, notes: null, created_at: '' }
			];
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: mockResults });

			const copies = await batchCreatePhysicalCopies(db, {
				editionId: 'ed-1',
				count: 3
			});

			expect(copies).toHaveLength(3);
			expect(db.batch).toHaveBeenCalled();
		});

		it('creates copies with prefix', async () => {
			const mockResults = [
				{ id: 'c1', edition_id: 'ed-1', copy_number: 'M-01', condition: 'good', acquired_at: null, notes: null, created_at: '' },
				{ id: 'c2', edition_id: 'ed-1', copy_number: 'M-02', condition: 'good', acquired_at: null, notes: null, created_at: '' }
			];
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: mockResults });

			const copies = await batchCreatePhysicalCopies(db, {
				editionId: 'ed-1',
				count: 2,
				prefix: 'M'
			});

			expect(copies).toHaveLength(2);
		});

		it('starts from custom number', async () => {
			const mockResults = [
				{ id: 'c1', edition_id: 'ed-1', copy_number: '10', condition: 'good', acquired_at: null, notes: null, created_at: '' },
				{ id: 'c2', edition_id: 'ed-1', copy_number: '11', condition: 'good', acquired_at: null, notes: null, created_at: '' }
			];
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: mockResults });

			await batchCreatePhysicalCopies(db, {
				editionId: 'ed-1',
				count: 2,
				startNumber: 10
			});

			expect(db.batch).toHaveBeenCalled();
		});

		it('throws on zero count', async () => {
			await expect(
				batchCreatePhysicalCopies(db, {
					editionId: 'ed-1',
					count: 0
				})
			).rejects.toThrow('Count must be positive');
		});

		it('throws on negative count', async () => {
			await expect(
				batchCreatePhysicalCopies(db, {
					editionId: 'ed-1',
					count: -5
				})
			).rejects.toThrow('Count must be positive');
		});

		it('auto-increments from existing copies when startNumber not specified', async () => {
			// First call to getNextAvailableCopyNumber - returns existing copies
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				results: [
					{ copy_number: '01' },
					{ copy_number: '02' },
					{ copy_number: '03' }
				]
			});
			// Second call - returns the newly created copies
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				results: [
					{ id: 'c1', edition_id: 'ed-1', copy_number: '01', condition: 'good', acquired_at: null, notes: null, created_at: '' },
					{ id: 'c2', edition_id: 'ed-1', copy_number: '02', condition: 'good', acquired_at: null, notes: null, created_at: '' },
					{ id: 'c3', edition_id: 'ed-1', copy_number: '03', condition: 'good', acquired_at: null, notes: null, created_at: '' },
					{ id: 'c4', edition_id: 'ed-1', copy_number: '4', condition: 'good', acquired_at: null, notes: null, created_at: '' },
					{ id: 'c5', edition_id: 'ed-1', copy_number: '5', condition: 'good', acquired_at: null, notes: null, created_at: '' }
				]
			});

			const copies = await batchCreatePhysicalCopies(db, {
				editionId: 'ed-1',
				count: 2
			});

			// Should return all copies including new ones starting from 4
			expect(copies).toHaveLength(5);
			expect(db.batch).toHaveBeenCalled();
		});
	});

	describe('getPhysicalCopyById', () => {
		it('returns copy when found', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'good',
				acquired_at: null,
				notes: null,
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const copy = await getPhysicalCopyById(db, 'copy-123');

			expect(copy).not.toBeNull();
			expect(copy?.id).toBe('copy-123');
			expect(copy?.copyNumber).toBe('01');
		});

		it('returns null when not found', async () => {
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(null);

			const copy = await getPhysicalCopyById(db, 'nonexistent');

			expect(copy).toBeNull();
		});
	});

	describe('getPhysicalCopiesByEdition', () => {
		it('returns empty array when no copies', async () => {
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });

			const copies = await getPhysicalCopiesByEdition(db, 'edition-1');

			expect(copies).toEqual([]);
		});

		it('returns all copies for edition', async () => {
			const mockResults = [
				{ id: 'c1', edition_id: 'ed-1', copy_number: '01', condition: 'good', acquired_at: null, notes: null, created_at: '' },
				{ id: 'c2', edition_id: 'ed-1', copy_number: '02', condition: 'fair', acquired_at: null, notes: null, created_at: '' }
			];
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: mockResults });

			const copies = await getPhysicalCopiesByEdition(db, 'ed-1');

			expect(copies).toHaveLength(2);
			expect(copies[0].condition).toBe('good');
			expect(copies[1].condition).toBe('fair');
		});
	});

	describe('updatePhysicalCopy', () => {
		it('updates condition', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'poor',
				acquired_at: null,
				notes: null,
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const updated = await updatePhysicalCopy(db, 'copy-123', { condition: 'poor' });

			expect(updated?.condition).toBe('poor');
		});

		it('updates notes', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'good',
				acquired_at: null,
				notes: 'New binding',
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const updated = await updatePhysicalCopy(db, 'copy-123', { notes: 'New binding' });

			expect(updated?.notes).toBe('New binding');
		});

		it('clears notes with null', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'good',
				acquired_at: null,
				notes: null,
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const updated = await updatePhysicalCopy(db, 'copy-123', { notes: null });

			expect(updated?.notes).toBeNull();
		});

		it('returns copy unchanged when no updates provided', async () => {
			const mockRow = {
				id: 'copy-123',
				edition_id: 'edition-1',
				copy_number: '01',
				condition: 'good',
				acquired_at: null,
				notes: null,
				created_at: '2026-01-29T12:00:00Z'
			};
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

			const updated = await updatePhysicalCopy(db, 'copy-123', {});

			expect(updated?.condition).toBe('good');
		});
	});

	describe('deletePhysicalCopy', () => {
		it('returns true when copy deleted', async () => {
			(db.prepare('').run as ReturnType<typeof vi.fn>).mockResolvedValue({ meta: { changes: 1 } });

			const result = await deletePhysicalCopy(db, 'copy-123');

			expect(result).toBe(true);
		});

		it('returns false when copy not found', async () => {
			(db.prepare('').run as ReturnType<typeof vi.fn>).mockResolvedValue({ meta: { changes: 0 } });

			const result = await deletePhysicalCopy(db, 'nonexistent');

			expect(result).toBe(false);
		});
	});

	describe('copyNumberExists', () => {
		it('returns true when copy number exists', async () => {
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue({ 1: 1 });

			const exists = await copyNumberExists(db, 'edition-1', '01');

			expect(exists).toBe(true);
		});

		it('returns false when copy number does not exist', async () => {
			(db.prepare('').first as ReturnType<typeof vi.fn>).mockResolvedValue(null);

			const exists = await copyNumberExists(db, 'edition-1', '99');

			expect(exists).toBe(false);
		});
	});

	describe('getCopyStats', () => {
		it('returns zero stats when no copies', async () => {
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });

			const stats = await getCopyStats(db, 'edition-1');

			expect(stats).toEqual({ total: 0, good: 0, fair: 0, poor: 0, lost: 0 });
		});

		it('returns correct stats by condition', async () => {
			const mockResults = [
				{ condition: 'good', count: 10 },
				{ condition: 'fair', count: 5 },
				{ condition: 'poor', count: 2 },
				{ condition: 'lost', count: 1 }
			];
			(db.prepare('').all as ReturnType<typeof vi.fn>).mockResolvedValue({ results: mockResults });

			const stats = await getCopyStats(db, 'edition-1');

			expect(stats.total).toBe(18);
			expect(stats.good).toBe(10);
			expect(stats.fair).toBe(5);
			expect(stats.poor).toBe(2);
			expect(stats.lost).toBe(1);
		});
	});
});
