// API endpoint for edition file operations
// GET /api/editions/[id]/file - Download file
// POST /api/editions/[id]/file - Upload file
// DELETE /api/editions/[id]/file - Remove file
import { error, type RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getAuthenticatedMember, assertLibrarian } from '$lib/server/auth/middleware';
import { getEditionById, updateEditionFile, removeEditionFile } from '$lib/server/db/editions';
import {
	uploadScoreChunked,
	getScoreFileChunked,
	deleteScoreFileChunked
} from '$lib/server/storage/d1-chunked-storage';
import type { Edition } from '$lib/types';

// Helper: Get DB with error handling
function getDb(platform: RequestEvent['platform']): D1Database {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	return db;
}

// Helper: Get edition by ID with validation
async function getValidatedEdition(db: D1Database, editionId: string | undefined): Promise<Edition> {
	if (!editionId) throw error(400, 'Edition ID is required');
	const edition = await getEditionById(db, editionId);
	if (!edition) throw error(404, 'Edition not found');
	return edition;
}

// Helper: Build PDF response
function buildPdfResponse(data: ArrayBuffer, size: number, fileName: string): Response {
	return new Response(data, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${fileName}"`,
			'Content-Length': size.toString()
		}
	});
}

export async function GET({ params, platform, cookies }: RequestEvent) {
	const db = getDb(platform);
	await getAuthenticatedMember(db, cookies);
	const edition = await getValidatedEdition(db, params.id);

	if (!edition.fileKey) throw error(404, 'No file attached to this edition');

	const file = await getScoreFileChunked(db, edition.fileKey);
	if (!file) throw error(404, 'File not found in storage');

	return buildPdfResponse(file.data, file.size, edition.fileName ?? 'score.pdf');
}

export async function POST({ params, request, platform, cookies }: RequestEvent) {
	const db = getDb(platform);
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const edition = await getValidatedEdition(db, params.id);
	const file = await extractAndValidateFile(request);

	// Delete existing file if present
	if (edition.fileKey) await deleteScoreFileChunked(db, edition.fileKey);

	// Upload new file using edition ID as key
	const fileKey = `edition-${params.id}`;
	await uploadScoreChunked(db, fileKey, file);

	// Update edition with file info
	const updated = await updateEditionFile(db, params.id!, {
		fileKey,
		fileName: file.name,
		fileSize: file.size,
		uploadedBy: member.id
	});

	if (!updated) throw error(500, 'Failed to update edition with file info');
	return json(updated);
}

// Helper: Extract and validate file from request
async function extractAndValidateFile(request: Request): Promise<File> {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) throw error(400, 'No file provided');
	if (file.type !== 'application/pdf') throw error(400, 'Only PDF files are allowed');

	return file;
}

export async function DELETE({ params, platform, cookies }: RequestEvent) {
	const db = getDb(platform);
	const member = await getAuthenticatedMember(db, cookies);
	assertLibrarian(member);

	const edition = await getValidatedEdition(db, params.id);
	if (!edition.fileKey) throw error(400, 'No file attached to this edition');

	await deleteScoreFileChunked(db, edition.fileKey);

	const updated = await removeEditionFile(db, params.id!);
	if (!updated) throw error(500, 'Failed to remove file info from edition');

	return json(updated);
}
