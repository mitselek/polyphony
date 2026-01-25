// GET /api/auth/accept?token=xxx - Accept an invitation
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GET as acceptInvite } from '$lib/server/api/auth';

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Missing invite token');
	}

	const result = await acceptInvite({ db, token });

	if (!result.success) {
		// Redirect to error page with message
		throw redirect(302, `/invite/error?message=${encodeURIComponent(result.error ?? 'Unknown error')}`);
	}

	// TODO: Create session cookie for the new member
	// For now, just set a simple cookie
	cookies.set('member_id', result.memberId!, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7 // 1 week
	});

	// Redirect to welcome page
	throw redirect(302, '/welcome');
};
