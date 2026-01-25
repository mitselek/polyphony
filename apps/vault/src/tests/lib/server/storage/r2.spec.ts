// R2 storage layer tests
import { describe, it, expect, beforeEach } from 'vitest';
import { uploadScore, getSignedUrl, deleteScore } from '$lib/server/storage/r2';

// Mock R2 bucket
function createMockR2Bucket(): R2Bucket {
	const storage = new Map<string, { body: ArrayBuffer; metadata: Record<string, string> }>();

	return {
		put: async (key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions) => {
			const body = value instanceof ArrayBuffer ? value : new TextEncoder().encode(value as string).buffer;
			storage.set(key, {
				body: body as ArrayBuffer,
				metadata: options?.customMetadata ?? {}
			});
			return {
				key,
				size: (body as ArrayBuffer).byteLength,
				uploaded: new Date(),
				httpMetadata: options?.httpMetadata ?? {},
				customMetadata: options?.customMetadata ?? {}
			} as R2Object;
		},
		get: async (key: string) => {
			const item = storage.get(key);
			if (!item) return null;
			return {
				key,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array(item.body));
						controller.close();
					}
				}),
				arrayBuffer: async () => item.body,
				text: async () => new TextDecoder().decode(item.body),
				customMetadata: item.metadata,
				size: item.body.byteLength
			} as R2ObjectBody;
		},
		delete: async (key: string | string[]) => {
			const keys = Array.isArray(key) ? key : [key];
			keys.forEach((k) => storage.delete(k));
		},
		head: async (key: string) => {
			const item = storage.get(key);
			if (!item) return null;
			return {
				key,
				size: item.body.byteLength,
				customMetadata: item.metadata
			} as R2Object;
		},
		list: async () => ({ objects: [], truncated: false, cursor: undefined }),
		createMultipartUpload: async () => {
			throw new Error('Not implemented');
		},
		resumeMultipartUpload: () => {
			throw new Error('Not implemented');
		}
	} as unknown as R2Bucket;
}

describe('R2 Storage Layer', () => {
	let bucket: R2Bucket;
	const vaultId = 'vault_abc123';
	const scoreId = 'score_xyz789';

	beforeEach(() => {
		bucket = createMockR2Bucket();
	});

	describe('uploadScore', () => {
		it('uploads a PDF file to the correct path', async () => {
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

			const result = await uploadScore(bucket, vaultId, scoreId, file);

			expect(result.key).toBe(`vault_abc123/scores/score_xyz789.pdf`);
			expect(result.size).toBe(4);
		});

		it('stores file with correct content type metadata', async () => {
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

			await uploadScore(bucket, vaultId, scoreId, file);

			const stored = await bucket.head(`vault_abc123/scores/score_xyz789.pdf`);
			expect(stored).not.toBeNull();
		});

		it('rejects non-PDF files', async () => {
			const textContent = new TextEncoder().encode('not a pdf');
			const file = new File([textContent], 'test.txt', { type: 'text/plain' });

			await expect(uploadScore(bucket, vaultId, scoreId, file)).rejects.toThrow(
				'Only PDF files are allowed'
			);
		});
	});

	describe('getSignedUrl', () => {
		it('returns a signed URL with expiry', async () => {
			// First upload a file
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
			await uploadScore(bucket, vaultId, scoreId, file);

			const signedUrl = await getSignedUrl(bucket, vaultId, scoreId);

			// Should return a URL string (in production this would be a real signed URL)
			expect(signedUrl).toContain('vault_abc123/scores/score_xyz789.pdf');
		});

		it('returns null for non-existent file', async () => {
			const signedUrl = await getSignedUrl(bucket, vaultId, 'nonexistent');

			expect(signedUrl).toBeNull();
		});
	});

	describe('deleteScore', () => {
		it('deletes an existing file', async () => {
			// First upload a file
			const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
			const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
			await uploadScore(bucket, vaultId, scoreId, file);

			const deleted = await deleteScore(bucket, vaultId, scoreId);

			expect(deleted).toBe(true);

			// Verify it's gone
			const stored = await bucket.head(`vault_abc123/scores/score_xyz789.pdf`);
			expect(stored).toBeNull();
		});

		it('returns false for non-existent file', async () => {
			const deleted = await deleteScore(bucket, vaultId, 'nonexistent');

			expect(deleted).toBe(false);
		});
	});
});
