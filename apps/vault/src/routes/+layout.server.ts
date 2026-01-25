// Server load for root layout - provides auth state to all pages
import { getMemberById } from '$lib/server/db/members';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, cookies }) => {
	const memberId = cookies.get('member_id');

	if (!memberId || !platform?.env?.DB) {
		return { user: null };
	}

	try {
		const member = await getMemberById(platform.env.DB, memberId);

		if (!member) {
			// Invalid session - clear cookie
			cookies.delete('member_id', { path: '/' });
			return { user: null };
		}

		return {
			user: {
				id: member.id,
				email: member.email,
				name: member.name,
				roles: member.roles,
				voice_part: member.voice_part
			}
		};
	} catch {
		return { user: null };
	}
};
