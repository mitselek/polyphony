// Server hooks for subdomain-based organization routing
// Implements #165 - Schema V2 multi-organization support

import type { Handle } from '@sveltejs/kit';
import { getOrganizationBySubdomain } from '$lib/server/db/organizations';

// Development fallback subdomain (for localhost:5173 without subdomain)
const DEV_SUBDOMAIN = 'crede';

// Subdomains to skip (not organization routing)
const SKIP_SUBDOMAINS = new Set(['www', 'api', 'static']);

/**
 * Extract the subdomain from a hostname
 * Returns null for skipped subdomains
 */
export function extractSubdomain(hostname: string): string | null {
	// Handle localhost variants
	if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
		// Pure localhost without subdomain → use dev fallback
		return DEV_SUBDOMAIN;
	}

	if (hostname.endsWith('.localhost') || hostname.includes('.localhost:')) {
		// Subdomain.localhost format (e.g., crede.localhost:5173)
		const subdomain = hostname.split('.')[0];
		if (SKIP_SUBDOMAINS.has(subdomain)) {
			return null;
		}
		return subdomain;
	}

	// Production hostname (e.g., crede.polyphony.uk)
	const parts = hostname.split('.');
	if (parts.length < 2) {
		// No subdomain in hostname
		return DEV_SUBDOMAIN;
	}

	const subdomain = parts[0];
	if (SKIP_SUBDOMAINS.has(subdomain)) {
		return null;
	}

	return subdomain;
}

export const handle: Handle = async ({ event, resolve }) => {
	const db = event.platform?.env?.DB;
	if (!db) {
		// Dev mode without wrangler - skip org routing
		// This allows running basic tests without DB
		return resolve(event);
	}

	// Extract subdomain from hostname
	const hostname = event.url.hostname;
	const subdomain = extractSubdomain(hostname);

	// Skip non-org subdomains (www, api, static)
	if (subdomain === null) {
		return resolve(event);
	}

	// Lookup organization by subdomain
	const org = await getOrganizationBySubdomain(db, subdomain);
	if (!org) {
		return new Response(`Organization "${subdomain}" not found`, {
			status: 404,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	// Set organization in locals for all routes
	event.locals.org = org;

	return resolve(event);
};
