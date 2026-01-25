// Server load for root layout - provides auth state to all pages
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, cookies }) => {
	const memberId = cookies.get('member_id');

	if (!memberId || !platform?.env?.DB) {
		return { user: null };
	}

	try {
		const member = await platform.env.DB.prepare(
			'SELECT id, email, name, role FROM members WHERE id = ?'
		)
			.bind(memberId)
			.first<{ id: string; email: string; name: string | null; role: string }>();

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
				role: member.role
			}
		};
	} catch {
		return { user: null };
	}
};
