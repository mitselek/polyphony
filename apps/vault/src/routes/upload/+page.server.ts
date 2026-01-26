// Server load for upload page - check auth before showing form
import { redirect } from '@sveltejs/kit';
import { canUploadScores } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Use permission system: only librarian and owner can upload
	const canUpload = canUploadScores(user ? { id: user.id, email: user.email, roles: user.roles } : null);

	if (!canUpload) {
		// Redirect unauthorized users to library
		redirect(303, '/library');
	}

	return {
		canUpload
	};
};
