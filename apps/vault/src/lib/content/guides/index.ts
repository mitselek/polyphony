// Guide metadata and content registry
// Guides are imported as raw markdown strings via Vite's ?raw suffix

import singerEt from './singer-et.md?raw';
import conductorEt from './conductor-et.md?raw';
import librarianEt from './librarian-et.md?raw';
import sectionLeaderEt from './section-leader-et.md?raw';
import adminEt from './admin-et.md?raw';

export interface GuideInfo {
	slug: string;
	/** Roles that should see this guide. Empty = everyone (singer guide). */
	roles: string[];
	titles: Record<string, string>;
	descriptions: Record<string, string>;
	content: Record<string, string>;
	/** Icon emoji for the guide card */
	icon: string;
	/** Display order */
	order: number;
}

export const guides: GuideInfo[] = [
	{
		slug: 'singer',
		roles: [], // Everyone sees this
		titles: {
			et: 'Laulja teejuht',
			en: 'Singer Guide'
		},
		descriptions: {
			et: 'Juhend koorilauljale igapäevaseks kasutamiseks',
			en: 'Daily usage guide for choir singers'
		},
		content: {
			et: singerEt
		},
		icon: '🎵',
		order: 1
	},
	{
		slug: 'conductor',
		roles: ['conductor'],
		titles: {
			et: 'Dirigendi teejuht',
			en: 'Conductor Guide'
		},
		descriptions: {
			et: 'Juhend proovide ja kontsertide haldamiseks',
			en: 'Guide for managing rehearsals and concerts'
		},
		content: {
			et: conductorEt
		},
		icon: '🎼',
		order: 2
	},
	{
		slug: 'librarian',
		roles: ['librarian'],
		titles: {
			et: 'Raamatukoguhoidja teejuht',
			en: 'Librarian Guide'
		},
		descriptions: {
			et: 'Juhend noodikogu haldamiseks ja korrashoiuks',
			en: 'Guide for managing and maintaining the score library'
		},
		content: {
			et: librarianEt
		},
		icon: '📚',
		order: 3
	},
	{
		slug: 'section-leader',
		roles: ['section_leader'],
		titles: {
			et: 'Häälerühma vanema teejuht',
			en: 'Section Leader Guide'
		},
		descriptions: {
			et: 'Juhend rühmavanemale kohaloleku märkimiseks',
			en: 'Guide for section leaders on attendance marking'
		},
		content: {
			et: sectionLeaderEt
		},
		icon: '👥',
		order: 4
	},
	{
		slug: 'admin',
		roles: ['admin', 'owner'],
		titles: {
			et: 'Administraatori teejuht',
			en: 'Admin Guide'
		},
		descriptions: {
			et: 'Ülevaade rollidest ja õigustest — kes mida teha saab',
			en: 'Overview of roles and permissions — who can do what'
		},
		content: {
			et: adminEt
		},
		icon: '⚙️',
		order: 5
	}
];

export function getGuideBySlug(slug: string): GuideInfo | undefined {
	return guides.find((g) => g.slug === slug);
}

/**
 * Get guides relevant to a member's roles.
 * The singer guide is always included.
 * If no roles provided (not logged in), show all guides.
 */
export function getGuidesForRoles(roles?: string[]): GuideInfo[] {
	if (!roles || roles.length === 0) {
		return [...guides].sort((a, b) => a.order - b.order);
	}

	return guides
		.filter((g) => {
			// Singer guide = always shown
			if (g.roles.length === 0) return true;
			// Owner sees everything
			if (roles.includes('owner')) return true;
			// Show if any of the member's roles matches
			return g.roles.some((r) => roles.includes(r));
		})
		.sort((a, b) => a.order - b.order);
}
