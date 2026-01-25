// D1 BLOB storage layer for PDF scores
// Stores PDFs directly in D1 database (2MB limit per file)

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface UploadResult {
	scoreId: string;
	size: number;
	originalName: string;
}

export interface ScoreFile {
	scoreId: string;
	data: ArrayBuffer;
	size: number;
	originalName: string;
	uploadedAt: string;
}

interface ScoreFileRow {
	score_id: string;
	data: ArrayBuffer;
	size: number;
	original_name: string;
	uploaded_at: string;
}

/**
 * Upload a PDF score to D1 BLOB storage
 * @throws Error if file is not a PDF or exceeds 2MB
 */
export async function uploadScore(
	db: D1Database,
	scoreId: string,
	file: File
): Promise<UploadResult> {
	// Validate file type
	if (file.type !== 'application/pdf') {
		throw new Error('Only PDF files are allowed');
	}

	// Validate file size
	if (file.size > MAX_FILE_SIZE) {
		throw new Error('File size exceeds 2MB limit');
	}

	const arrayBuffer = await file.arrayBuffer();

	await db
		.prepare(
			'INSERT INTO score_files (score_id, data, size, original_name) VALUES (?, ?, ?, ?)'
		)
		.bind(scoreId, arrayBuffer, file.size, file.name)
		.run();

	return {
		scoreId,
		size: file.size,
		originalName: file.name
	};
}

/**
 * Get a score file from D1
 * Returns null if the file doesn't exist
 */
export async function getScoreFile(
	db: D1Database,
	scoreId: string
): Promise<ScoreFile | null> {
	const row = await db
		.prepare(
			'SELECT score_id, data, size, original_name, uploaded_at FROM score_files WHERE score_id = ?'
		)
		.bind(scoreId)
		.first<ScoreFileRow>();

	if (!row) {
		return null;
	}

	return {
		scoreId: row.score_id,
		data: row.data,
		size: row.size,
		originalName: row.original_name,
		uploadedAt: row.uploaded_at
	};
}

/**
 * Delete a score file from D1
 * Returns true if file was deleted, false if it didn't exist
 */
export async function deleteScoreFile(
	db: D1Database,
	scoreId: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM score_files WHERE score_id = ?')
		.bind(scoreId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
