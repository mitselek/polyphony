// R2 storage layer for PDF scores

export interface UploadResult {
	key: string;
	size: number;
}

/**
 * Build the R2 key path for a score
 */
function getScoreKey(vaultId: string, scoreId: string): string {
	return `${vaultId}/scores/${scoreId}.pdf`;
}

/**
 * Upload a PDF score to R2
 * @throws Error if file is not a PDF
 */
export async function uploadScore(
	bucket: R2Bucket,
	vaultId: string,
	scoreId: string,
	file: File
): Promise<UploadResult> {
	// Validate file type
	if (file.type !== 'application/pdf') {
		throw new Error('Only PDF files are allowed');
	}

	const key = getScoreKey(vaultId, scoreId);
	const arrayBuffer = await file.arrayBuffer();

	const result = await bucket.put(key, arrayBuffer, {
		httpMetadata: {
			contentType: 'application/pdf'
		},
		customMetadata: {
			originalName: file.name,
			uploadedAt: new Date().toISOString()
		}
	});

	return {
		key: result.key,
		size: result.size
	};
}

/**
 * Get a signed URL for downloading a score
 * Returns null if the file doesn't exist
 * 
 * Note: R2 signed URLs require using createSignedUrl on R2Bucket in production.
 * For development/testing, we return the key path directly.
 */
export async function getSignedUrl(
	bucket: R2Bucket,
	vaultId: string,
	scoreId: string,
	_expiresInSeconds = 900 // 15 minutes default
): Promise<string | null> {
	const key = getScoreKey(vaultId, scoreId);

	// Check if file exists
	const head = await bucket.head(key);
	if (!head) {
		return null;
	}

	// In production, you would use:
	// return await bucket.createSignedUrl(key, { expiresIn: expiresInSeconds });
	// 
	// For testing/development, return the key path
	// The actual signed URL generation would be done via Workers API
	return key;
}

/**
 * Delete a score from R2
 * Returns true if file was deleted, false if it didn't exist
 */
export async function deleteScore(
	bucket: R2Bucket,
	vaultId: string,
	scoreId: string
): Promise<boolean> {
	const key = getScoreKey(vaultId, scoreId);

	// Check if file exists first
	const head = await bucket.head(key);
	if (!head) {
		return false;
	}

	await bucket.delete(key);
	return true;
}

/**
 * Get file metadata without downloading content
 */
export async function getScoreMetadata(
	bucket: R2Bucket,
	vaultId: string,
	scoreId: string
): Promise<{ size: number; uploadedAt: string; originalName: string } | null> {
	const key = getScoreKey(vaultId, scoreId);

	const head = await bucket.head(key);
	if (!head) {
		return null;
	}

	return {
		size: head.size,
		uploadedAt: head.customMetadata?.uploadedAt ?? '',
		originalName: head.customMetadata?.originalName ?? ''
	};
}
