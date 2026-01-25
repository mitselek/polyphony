// TDD: Tests for chunked D1 storage
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll test the chunked storage module
import {
	CHUNK_SIZE,
	MAX_CHUNKED_FILE_SIZE,
	uploadScoreChunked,
	getScoreFileChunked,
	deleteScoreFileChunked,
	isChunkedFile
} from '../../../../lib/server/storage/d1-chunked-storage';

// Mock D1Database
function createMockDb() {
	const mockStmt = {
		bind: vi.fn().mockReturnThis(),
		run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
		first: vi.fn().mockResolvedValue(null),
		all: vi.fn().mockResolvedValue({ results: [] })
	};
	return {
		prepare: vi.fn().mockReturnValue(mockStmt),
		batch: vi.fn().mockResolvedValue([]),
		_mockStmt: mockStmt
	} as unknown as D1Database & { _mockStmt: typeof mockStmt };
}

// Helper to create a mock file
function createMockFile(size: number, name = 'test.pdf'): File {
	const buffer = new ArrayBuffer(size);
	const blob = new Blob([buffer], { type: 'application/pdf' });
	return new File([blob], name, { type: 'application/pdf' });
}

describe('Chunked Storage Constants', () => {
	it('should define CHUNK_SIZE as ~1.9MB (under 2MB D1 limit)', () => {
		expect(CHUNK_SIZE).toBeLessThan(2 * 1024 * 1024);
		expect(CHUNK_SIZE).toBeGreaterThan(1.5 * 1024 * 1024);
	});

	it('should define MAX_CHUNKED_FILE_SIZE as 10MB', () => {
		expect(MAX_CHUNKED_FILE_SIZE).toBe(10 * 1024 * 1024);
	});
});

describe('isChunkedFile', () => {
	it('should return false for files under 2MB', () => {
		expect(isChunkedFile(1 * 1024 * 1024)).toBe(false);
		expect(isChunkedFile(1.9 * 1024 * 1024)).toBe(false);
	});

	it('should return true for files over 2MB', () => {
		expect(isChunkedFile(2 * 1024 * 1024 + 1)).toBe(true);
		expect(isChunkedFile(5 * 1024 * 1024)).toBe(true);
	});
});

describe('uploadScoreChunked', () => {
	let db: D1Database & { _mockStmt: ReturnType<typeof createMockDb>['_mockStmt'] };

	beforeEach(() => {
		db = createMockDb();
		vi.clearAllMocks();
	});

	it('should reject non-PDF files', async () => {
		const file = new File(['test'], 'test.txt', { type: 'text/plain' });
		
		await expect(uploadScoreChunked(db, 'score-1', file))
			.rejects.toThrow('Only PDF files are allowed');
	});

	it('should reject files over 10MB', async () => {
		const file = createMockFile(11 * 1024 * 1024);
		
		await expect(uploadScoreChunked(db, 'score-1', file))
			.rejects.toThrow('File size exceeds 10MB limit');
	});

	it('should upload small files to score_files table', async () => {
		const file = createMockFile(1 * 1024 * 1024); // 1MB
		
		const result = await uploadScoreChunked(db, 'score-1', file);
		
		expect(result.scoreId).toBe('score-1');
		expect(result.size).toBe(1 * 1024 * 1024);
		expect(result.isChunked).toBe(false);
		expect(result.chunkCount).toBeUndefined();
	});

	it('should upload large files in chunks', async () => {
		const file = createMockFile(5 * 1024 * 1024); // 5MB
		
		const result = await uploadScoreChunked(db, 'score-1', file);
		
		expect(result.scoreId).toBe('score-1');
		expect(result.size).toBe(5 * 1024 * 1024);
		expect(result.isChunked).toBe(true);
		expect(result.chunkCount).toBeGreaterThan(1);
	});

	it('should calculate correct number of chunks', async () => {
		// 5MB file with ~1.9MB chunks = 3 chunks
		const file = createMockFile(5 * 1024 * 1024);
		
		const result = await uploadScoreChunked(db, 'score-1', file);
		
		// 5MB / 1.9MB ≈ 2.6, rounds up to 3
		expect(result.chunkCount).toBeGreaterThanOrEqual(3);
		expect(result.chunkCount).toBeLessThanOrEqual(4);
	});
});

describe('getScoreFileChunked', () => {
	let db: D1Database & { _mockStmt: ReturnType<typeof createMockDb>['_mockStmt'] };

	beforeEach(() => {
		db = createMockDb();
		vi.clearAllMocks();
	});

	it('should return null for non-existent score', async () => {
		db._mockStmt.first.mockResolvedValue(null);
		
		const result = await getScoreFileChunked(db, 'non-existent');
		
		expect(result).toBeNull();
	});

	it('should return single-row file directly', async () => {
		const mockData = new ArrayBuffer(100);
		db._mockStmt.first.mockResolvedValue({
			score_id: 'score-1',
			data: mockData,
			size: 100,
			original_name: 'test.pdf',
			uploaded_at: '2026-01-25',
			is_chunked: 0,
			chunk_count: null
		});
		
		const result = await getScoreFileChunked(db, 'score-1');
		
		expect(result).not.toBeNull();
		expect(result?.scoreId).toBe('score-1');
		expect(result?.size).toBe(100);
	});

	it('should reassemble chunked file', async () => {
		// First call returns metadata
		db._mockStmt.first.mockResolvedValue({
			score_id: 'score-1',
			data: null, // No data in metadata row for chunked files
			size: 100,
			original_name: 'test.pdf',
			uploaded_at: '2026-01-25',
			is_chunked: 1,
			chunk_count: 2
		});
		
		// Second call (all) returns chunks
		const chunk1 = new ArrayBuffer(50);
		const chunk2 = new ArrayBuffer(50);
		db._mockStmt.all.mockResolvedValue({
			results: [
				{ chunk_index: 0, data: chunk1, size: 50 },
				{ chunk_index: 1, data: chunk2, size: 50 }
			]
		});
		
		const result = await getScoreFileChunked(db, 'score-1');
		
		expect(result).not.toBeNull();
		expect(result?.size).toBe(100);
	});
});

describe('deleteScoreFileChunked', () => {
	let db: D1Database & { _mockStmt: ReturnType<typeof createMockDb>['_mockStmt'] };

	beforeEach(() => {
		db = createMockDb();
		vi.clearAllMocks();
	});

	it('should delete file and its chunks', async () => {
		db._mockStmt.run.mockResolvedValue({ meta: { changes: 1 } });
		
		const result = await deleteScoreFileChunked(db, 'score-1');
		
		expect(result).toBe(true);
		// Should delete from both tables (CASCADE handles chunks)
		expect(db.prepare).toHaveBeenCalled();
	});

	it('should return false if file did not exist', async () => {
		db._mockStmt.run.mockResolvedValue({ meta: { changes: 0 } });
		
		const result = await deleteScoreFileChunked(db, 'non-existent');
		
		expect(result).toBe(false);
	});
});
