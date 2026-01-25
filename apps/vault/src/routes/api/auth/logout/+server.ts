// GET /api/auth/logout - Clear session and redirect to home
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete('member_id', { path: '/' });
	return redirect(302, '/');
};
