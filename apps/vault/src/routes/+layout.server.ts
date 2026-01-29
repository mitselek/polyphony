// Server load for root layout - provides auth state to all pages
import { getMemberById } from '$lib/server/db/members';
import { getSetting } from '$lib/server/db/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, cookies }) => {
	const memberId = cookies.get('member_id');

	if (!memberId || !platform?.env?.DB) {
		return { user: null, locale: 'system' };
	}

	try {
		const [member, localeSetting] = await Promise.all([
			getMemberById(platform.env.DB, memberId),
			getSetting(platform.env.DB, 'locale')
		]);

		const locale = localeSetting || 'system';

		if (!member) {
			// Invalid session - clear cookie
			cookies.delete('member_id', { path: '/' });
			return { user: null, locale };
		}

		return {
			user: {
				id: member.id,
				email: member.email_id,
				name: member.name,
				roles: member.roles,
				voices: member.voices,
				sections: member.sections
			},
			locale
		};
	} catch {
		return { user: null, locale: 'system' };
	}
};
