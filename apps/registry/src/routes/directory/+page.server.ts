// Server-side load for directory page
/// <reference types="@cloudflare/workers-types" />
import type { PageServerLoad } from './$types';

interface Vault {
	id: string;
	name: string;
	callback_url: string;
	registered_at: string;
	active: number;
}

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) {
		return { vaults: [] };
	}

	const { results } = await platform.env.DB.prepare(
		'SELECT id, name, callback_url, registered_at FROM vaults WHERE active = 1 ORDER BY name ASC'
	).all<Vault>();

	// Extract subdomain from callback_url for display
	const vaults = results.map((vault) => {
		let subdomain = '';
		let url = '';
		try {
			const parsed = new URL(vault.callback_url);
			// callback_url is like https://crede.polyphony.uk/api/auth/callback
			// We want the origin: https://crede.polyphony.uk
			url = parsed.origin;
			// Extract subdomain from hostname
			const parts = parsed.hostname.split('.');
			if (parts.length >= 3) {
				subdomain = parts[0];
			}
		} catch {
			url = vault.callback_url;
		}

		return {
			id: vault.id,
			name: vault.name,
			subdomain,
			url,
			registeredAt: vault.registered_at
		};
	});

	return { vaults };
};
