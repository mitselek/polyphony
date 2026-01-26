// API endpoint for managing member voices
// POST - Add voice to member
// DELETE - Remove voice from member
import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { getMemberById, addMemberVoice, removeMemberVoice } from '$lib/server/db/members';
import { z } from 'zod';

const voiceSchema = z.object({
	voiceId: z.string().min(1),
	isPrimary: z.boolean().optional().default(false)
});

const deleteVoiceSchema = z.object({
	voiceId: z.string().min(1)
});

/**
 * POST /api/members/[id]/voices
 * Add a voice to a member
 */
export async function POST(event: RequestEvent) {
	const { params, request, platform, cookies } = event;
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = params.id;
	if (!memberId) {
		throw error(400, 'Member ID is required');
	}

	// Auth: require admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);

	// Validate request body
	const body = await request.json();
	const parsed = voiceSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, 'Invalid request body: ' + parsed.error.message);
	}

	const { voiceId, isPrimary } = parsed.data;

	// Verify member exists
	const member = await getMemberById(db, memberId);
	if (!member) {
		throw error(404, 'Member not found');
	}

	// Add voice
	await addMemberVoice(db, memberId, voiceId, isPrimary, currentMember.id);

	return json({
		message: 'Voice added successfully',
		memberId,
		voiceId,
		isPrimary
	});
}

/**
 * DELETE /api/members/[id]/voices
 * Remove a voice from a member
 */
export async function DELETE(event: RequestEvent) {
	const { params, request, platform, cookies } = event;
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const memberId = params.id;
	if (!memberId) {
		throw error(400, 'Member ID is required');
	}

	// Auth: require admin role
	const currentMember = await getAuthenticatedMember(db, cookies);
	assertAdmin(currentMember);

	// Validate request body
	const body = await request.json();
	const parsed = deleteVoiceSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, 'Invalid request body: ' + parsed.error.message);
	}

	const { voiceId } = parsed.data;

	// Verify member exists
	const member = await getMemberById(db, memberId);
	if (!member) {
		throw error(404, 'Member not found');
	}

	// Remove voice
	const removed = await removeMemberVoice(db, memberId, voiceId);
	if (!removed) {
		throw error(404, 'Voice not assigned to this member');
	}

	return json({
		message: 'Voice removed successfully',
		memberId,
		voiceId
	});
}
