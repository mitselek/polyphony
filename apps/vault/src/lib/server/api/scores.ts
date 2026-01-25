// Score API handlers
import { createScore, getScoreById, listScores, softDeleteScore, type CreateScoreInput } from '$lib/server/db/scores';
import { 
	uploadScoreChunked, 
	getScoreFileChunked, 
	deleteScoreFileChunked,
	MAX_CHUNKED_FILE_SIZE 
} from '$lib/server/storage/d1-chunked-storage';

export interface ScoreListItem {
	id: string;
	title: string;
	composer: string | null;
	arranger: string | null;
	license_type: string;
	uploaded_at: string;
}

export interface GetParams {
	db: D1Database;
	limit?: number;
	offset?: number;
}

export interface GetResult {
	scores: ScoreListItem[];
	total: number;
}

export interface PostParams {
	db: D1Database;
	body: {
		title: string;
		composer?: string;
		arranger?: string;
		license_type: 'public_domain' | 'licensed' | 'owned' | 'pending';
	};
	file: File;
	memberId: string;
}

export interface PostResult {
	id: string;
	title: string;
	composer: string | null;
	arranger: string | null;
	license_type: string;
}

export interface DeleteParams {
	db: D1Database;
	scoreId: string;
	memberId: string;
}

export interface DeleteResult {
	deleted: boolean;
}

/**
 * GET /api/scores - List all scores
 */
export async function GET(params: GetParams): Promise<GetResult> {
	const scores = await listScores(params.db);

	return {
		scores: scores.map((s) => ({
			id: s.id,
			title: s.title,
			composer: s.composer,
			arranger: s.arranger,
			license_type: s.license_type,
			uploaded_at: s.uploaded_at
		})),
		total: scores.length
	};
}

/**
 * POST /api/scores - Create new score with PDF upload
 */
export async function POST(params: PostParams): Promise<PostResult> {
	const { db, body, file, memberId } = params;

	// Validate required fields
	if (!body.title) {
		throw new Error('Title is required');
	}

	// Validate file type
	if (file.type !== 'application/pdf') {
		throw new Error('Only PDF files are allowed');
	}

	// Validate file size (now supports up to 10MB with chunking)
	if (file.size > MAX_CHUNKED_FILE_SIZE) {
		throw new Error('File size exceeds 10MB limit');
	}

	// Generate ID
	const id = crypto.randomUUID().replace(/-/g, '').slice(0, 21);

	// Create score metadata in D1
	const scoreInput: CreateScoreInput = {
		title: body.title,
		composer: body.composer,
		arranger: body.arranger,
		license_type: body.license_type,
		file_key: id, // Use score ID as file key
		uploaded_by: memberId
	};

	// Insert score record (will use the generated ID from createScore)
	const score = await createScore(db, scoreInput);

	// Upload file to D1 storage (automatic chunking for large files)
	await uploadScoreChunked(db, score.id, file);

	return {
		id: score.id,
		title: score.title,
		composer: score.composer,
		arranger: score.arranger,
		license_type: score.license_type
	};
}

export interface GetOneParams {
	db: D1Database;
	scoreId: string;
}

/**
 * GET /api/scores/:id - Get score metadata
 */
export async function GET_ONE(params: GetOneParams) {
	const { db, scoreId } = params;

	const score = await getScoreById(db, scoreId);
	if (!score) {
		return null;
	}

	return {
		id: score.id,
		title: score.title,
		composer: score.composer,
		arranger: score.arranger,
		license_type: score.license_type,
		uploaded_at: score.uploaded_at
	};
}

export interface DownloadParams {
	db: D1Database;
	scoreId: string;
}

export interface DownloadResult {
	data: ArrayBuffer;
	originalName: string;
	size: number;
}

/**
 * GET /api/scores/:id/download - Download score PDF
 */
export async function DOWNLOAD(params: DownloadParams): Promise<DownloadResult | null> {
	const { db, scoreId } = params;

	// Check score exists and not deleted
	const score = await getScoreById(db, scoreId);
	if (!score || score.deleted_at) {
		return null;
	}

	// Get file from D1 (with automatic chunk reassembly)
	const file = await getScoreFileChunked(db, scoreId);
	if (!file) {
		return null;
	}

	return {
		data: file.data,
		originalName: file.originalName,
		size: file.size
	};
}

/**
 * DELETE /api/scores/:id - Soft delete a score
 */
export async function DELETE(params: DeleteParams): Promise<DeleteResult> {
	const { db, scoreId } = params;

	const deleted = await softDeleteScore(db, scoreId);

	return { deleted };
}
