// Server load for upload page - check auth before showing form
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Check if user has librarian or admin role (owner has all permissions)
	const canUpload = user?.roles?.some(role => ['librarian', 'admin', 'owner'].includes(role)) ?? false;

	return {
		canUpload
	};
};
