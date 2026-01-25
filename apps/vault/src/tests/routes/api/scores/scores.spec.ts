// Score API endpoint tests
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, DELETE, type PostParams } from '$lib/server/api/scores';

// Mock D1 database
function createMockD1() {
	const members = new Map<string, { id: string; email: string; name: string; role: string }>();
	const scores = new Map<string, { id: string; title: string; composer: string | null; arranger: string | null; license_type: string; file_key: string; uploaded_by: string | null; uploaded_at: string; deleted_at: string | null }>();
	const scoreFiles = new Map<string, { score_id: string; data: ArrayBuffer; size: number; original_name: string; uploaded_at: string }>();

	// Seed test member
	members.set('member_1', { id: 'member_1', email: 'test@choir.org', name: 'Test User', role: 'librarian' });

	return {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					if (sql.includes('INSERT INTO scores')) {
						const [id, title, composer, arranger, license_type, file_key, uploaded_by] = params as string[];
						scores.set(id, { id, title, composer, arranger, license_type, file_key, uploaded_by, uploaded_at: new Date().toISOString(), deleted_at: null });
						return { meta: { changes: 1 } };
					}
					if (sql.includes('INSERT INTO score_files')) {
						const [score_id, data, size, original_name] = params as [string, ArrayBuffer, number, string];
						scoreFiles.set(score_id, { score_id, data, size, original_name, uploaded_at: new Date().toISOString() });
						return { meta: { changes: 1 } };
					}
					if (sql.includes('UPDATE scores SET deleted_at')) {
						const [id] = params as [string];
						const score = scores.get(id);
						if (score && !score.deleted_at) {
							score.deleted_at = new Date().toISOString();
							return { meta: { changes: 1 } };
						}
						return { meta: { changes: 0 } };
					}
					return { meta: { changes: 0 } };
				},
				first: async <T>() => {
					if (sql.includes('SELECT') && sql.includes('FROM scores WHERE id')) {
						const [id] = params as [string];
						return (scores.get(id) ?? null) as T;
					}
					if (sql.includes('SELECT') && sql.includes('FROM score_files')) {
						const [score_id] = params as [string];
						return (scoreFiles.get(score_id) ?? null) as T;
					}
					if (sql.includes('SELECT') && sql.includes('FROM members')) {
						const [id] = params as [string];
						return (members.get(id) ?? null) as T;
					}
					return null;
				},
				all: async <T>() => {
					if (sql.includes('SELECT') && sql.includes('FROM scores') && sql.includes('deleted_at IS NULL')) {
						const results = Array.from(scores.values()).filter(s => !s.deleted_at);
						return { results: results as T[] };
					}
					return { results: [] };
				}
			}),
			// Direct .all() without bind (used by listScores)
			all: async <T>() => {
				if (sql.includes('SELECT') && sql.includes('FROM scores') && sql.includes('deleted_at IS NULL')) {
					const results = Array.from(scores.values()).filter(s => !s.deleted_at);
					return { results: results as T[] };
				}
				return { results: [] };
			}
		}),
		batch: async () => [],
		dump: async () => new ArrayBuffer(0),
		exec: async () => ({ count: 0, duration: 0 })
	} as unknown as D1Database;
}

describe('Score API', () => {
	let db: D1Database;

	beforeEach(() => {
		db = createMockD1();
	});

	describe('GET /api/scores', () => {
		it('returns empty list when no scores', async () => {
			const result = await GET({ db });

			expect(result.scores).toEqual([]);
			expect(result.total).toBe(0);
		});

		it('returns list of scores', async () => {
			// Create a score first
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

			await POST({
				db,
				body: {
					title: 'Test Song',
					composer: 'J.S. Bach',
					license_type: 'public_domain'
				},
				file,
				memberId: 'member_1'
			});

			const result = await GET({ db });

			expect(result.scores).toHaveLength(1);
			expect(result.scores[0].title).toBe('Test Song');
			expect(result.scores[0].composer).toBe('J.S. Bach');
			expect(result.total).toBe(1);
		});
	});

	describe('POST /api/scores', () => {
		it('creates a new score with PDF', async () => {
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'song.pdf', { type: 'application/pdf' });

			const result = await POST({
				db,
				body: {
					title: 'Amazing Grace',
					composer: 'John Newton',
					arranger: 'arr. Smith',
					license_type: 'public_domain'
				},
				file,
				memberId: 'member_1'
			});

			expect(result.id).toBeDefined();
			expect(result.title).toBe('Amazing Grace');
			expect(result.composer).toBe('John Newton');
		});

		it('rejects non-PDF files', async () => {
			const textContent = new TextEncoder().encode('not a pdf');
			const file = new File([textContent], 'test.txt', { type: 'text/plain' });

			await expect(
				POST({
					db,
					body: { title: 'Test', license_type: 'public_domain' },
					file,
					memberId: 'member_1'
				})
			).rejects.toThrow('Only PDF files are allowed');
		});

		it('rejects files over 9.5MB', async () => {
			const largeContent = new Uint8Array(Math.floor(9.5 * 1024 * 1024) + 1);
			const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

			await expect(
				POST({
					db,
					body: { title: 'Test', license_type: 'public_domain' },
					file,
					memberId: 'member_1'
				})
			).rejects.toThrow('File size exceeds 9.5MB limit');
		});

		it('requires title', async () => {
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

			await expect(
				POST({
					db,
					body: { license_type: 'public_domain' } as Partial<PostParams['body']> as PostParams['body'],
					file,
					memberId: 'member_1'
				})
			).rejects.toThrow('Title is required');
		});
	});

	describe('DELETE /api/scores/:id', () => {
		it('soft deletes an existing score', async () => {
			// Create first
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
			const created = await POST({
				db,
				body: { title: 'To Delete', license_type: 'public_domain' },
				file,
				memberId: 'member_1'
			});

			const result = await DELETE({ db, scoreId: created.id, memberId: 'member_1' });

			expect(result.deleted).toBe(true);

			// Should not appear in list
			const list = await GET({ db });
			expect(list.scores).toHaveLength(0);
		});

		it('returns false for non-existent score', async () => {
			const result = await DELETE({ db, scoreId: 'nonexistent', memberId: 'member_1' });

			expect(result.deleted).toBe(false);
		});
	});
});
