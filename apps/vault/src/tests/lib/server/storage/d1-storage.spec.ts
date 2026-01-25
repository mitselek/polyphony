// D1 BLOB storage layer tests
import { describe, it, expect, beforeEach } from 'vitest';
import { uploadScore, getScoreFile, deleteScoreFile, MAX_FILE_SIZE } from '$lib/server/storage/d1-storage';

// Mock D1 database for file storage
function createMockD1(): D1Database {
	const storage = new Map<string, { data: ArrayBuffer; size: number; original_name: string; uploaded_at: string }>();

	return {
		prepare: (sql: string) => {
			return {
				bind: (...params: unknown[]) => ({
					run: async () => {
						if (sql.includes('INSERT INTO score_files')) {
							const [score_id, data, size, original_name] = params as [string, ArrayBuffer, number, string];
							storage.set(score_id, {
								data,
								size,
								original_name,
								uploaded_at: new Date().toISOString()
							});
							return { meta: { changes: 1 } };
						}
						if (sql.includes('DELETE FROM score_files')) {
							const [score_id] = params as [string];
							const existed = storage.has(score_id);
							storage.delete(score_id);
							return { meta: { changes: existed ? 1 : 0 } };
						}
						return { meta: { changes: 0 } };
					},
					first: async <T>() => {
						if (sql.includes('SELECT')) {
							const [score_id] = params as [string];
							const item = storage.get(score_id);
							if (!item) return null;
							return {
								score_id,
								data: item.data,
								size: item.size,
								original_name: item.original_name,
								uploaded_at: item.uploaded_at
							} as T;
						}
						return null;
					}
				})
			};
		},
		batch: async () => [],
		dump: async () => new ArrayBuffer(0),
		exec: async () => ({ count: 0, duration: 0 })
	} as unknown as D1Database;
}

describe('D1 BLOB Storage Layer', () => {
	let db: D1Database;
	const scoreId = 'score_xyz789';

	beforeEach(() => {
		db = createMockD1();
	});

	describe('uploadScore', () => {
		it('stores a PDF file in D1', async () => {
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

			const result = await uploadScore(db, scoreId, file);

			expect(result.scoreId).toBe(scoreId);
			expect(result.size).toBe(4);
			expect(result.originalName).toBe('test.pdf');
		});

		it('rejects non-PDF files', async () => {
			const textContent = new TextEncoder().encode('not a pdf');
			const file = new File([textContent], 'test.txt', { type: 'text/plain' });

			await expect(uploadScore(db, scoreId, file)).rejects.toThrow(
				'Only PDF files are allowed'
			);
		});

		it('rejects files larger than 2MB', async () => {
			// Create a file just over 2MB
			const largeContent = new Uint8Array(2 * 1024 * 1024 + 1);
			const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

			await expect(uploadScore(db, scoreId, file)).rejects.toThrow(
				'File size exceeds 2MB limit'
			);
		});

		it('accepts files exactly at 2MB limit', async () => {
			const maxContent = new Uint8Array(2 * 1024 * 1024);
			// Add PDF header
			maxContent[0] = 0x25; // %
			maxContent[1] = 0x50; // P
			maxContent[2] = 0x44; // D
			maxContent[3] = 0x46; // F
			const file = new File([maxContent], 'max.pdf', { type: 'application/pdf' });

			const result = await uploadScore(db, scoreId, file);

			expect(result.size).toBe(2 * 1024 * 1024);
		});
	});

	describe('getScoreFile', () => {
		it('retrieves a stored file', async () => {
			// First upload
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
			await uploadScore(db, scoreId, file);

			const result = await getScoreFile(db, scoreId);

			expect(result).not.toBeNull();
			expect(result!.size).toBe(4);
			expect(result!.originalName).toBe('test.pdf');
			expect(result!.data).toBeInstanceOf(ArrayBuffer);
		});

		it('returns null for non-existent file', async () => {
			const result = await getScoreFile(db, 'nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('deleteScoreFile', () => {
		it('deletes an existing file', async () => {
			// First upload
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
			await uploadScore(db, scoreId, file);

			const deleted = await deleteScoreFile(db, scoreId);

			expect(deleted).toBe(true);

			// Verify it's gone
			const result = await getScoreFile(db, scoreId);
			expect(result).toBeNull();
		});

		it('returns false for non-existent file', async () => {
			const deleted = await deleteScoreFile(db, 'nonexistent');

			expect(deleted).toBe(false);
		});
	});

	describe('MAX_FILE_SIZE', () => {
		it('is set to 2MB', () => {
			expect(MAX_FILE_SIZE).toBe(2 * 1024 * 1024);
		});
	});
});
