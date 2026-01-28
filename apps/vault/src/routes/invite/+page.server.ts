// Server load for invite page - check permissions and load voices/sections
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedMember, assertAdmin, isOwner } from '$lib/server/auth/middleware';
import { getActiveVoices } from '$lib/server/db/voices';
import { getActiveSections } from '$lib/server/db/sections';

export const load: PageServerLoad = async ({ platform, cookies, url }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Auth: get member and check admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Load active voices and sections for the form
	const [voices, sections] = await Promise.all([
		getActiveVoices(db),
		getActiveSections(db)
	]);

	// Pre-fill from URL params (for roster member invitations)
	const prefillName = url.searchParams.get('name') ?? '';
	const prefillVoicesRaw = url.searchParams.get('voices')?.split(',').filter(Boolean) ?? [];
	const prefillSectionsRaw = url.searchParams.get('sections')?.split(',').filter(Boolean) ?? [];

	// Only include prefill IDs that exist in active options
	// (member may have inactive voices/sections assigned)
	const activeVoiceIds = new Set(voices.map((v) => v.id));
	const activeSectionIds = new Set(sections.map((s) => s.id));
	const prefillVoices = prefillVoicesRaw.filter((id) => activeVoiceIds.has(id));
	const prefillSections = prefillSectionsRaw.filter((id) => activeSectionIds.has(id));

	return {
		isOwner: isOwner(member),
		voices,
		sections,
		prefill: {
			name: prefillName,
			voiceIds: prefillVoices,
			sectionIds: prefillSections
		}
	};
};
