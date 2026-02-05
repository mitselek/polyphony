// Subdomain availability check API
// GET /api/subdomains/check?name=xxx

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOrganizationBySubdomain } from '$lib/server/db/organizations';

// Reserved subdomains that cannot be used
const RESERVED_SUBDOMAINS = [
	'www',
	'api',
	'admin',
	'app',
	'mail',
	'smtp',
	'ftp',
	'cdn',
	'static',
	'assets',
	'registry',
	'vault',
	'polyphony',
	'support',
	'help',
	'docs',
	'blog',
	'status',
	'test',
	'staging',
	'dev',
	'demo'
];

// Validation regex: lowercase alphanumeric + hyphens, no start/end hyphen
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export interface SubdomainCheckResponse {
	available: boolean;
	reason?: 'taken' | 'reserved' | 'invalid';
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const name = url.searchParams.get('name');

	// Validate parameter exists
	if (!name) {
		return json({ error: 'Missing name parameter' }, { status: 400 });
	}

	// Normalize to lowercase
	const subdomain = name.toLowerCase().trim();

	// Validate length
	if (subdomain.length < 3) {
		return json({ error: 'Subdomain must be at least 3 characters' }, { status: 400 });
	}

	if (subdomain.length > 30) {
		return json({ error: 'Subdomain must be at most 30 characters' }, { status: 400 });
	}

	// Validate format
	if (!SUBDOMAIN_REGEX.test(subdomain)) {
		if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
			return json({ error: 'Subdomain cannot start or end with a hyphen' }, { status: 400 });
		}
		return json({ error: 'Subdomain contains invalid characters (use lowercase letters, numbers, and hyphens only)' }, { status: 400 });
	}

	// Check reserved list
	if (RESERVED_SUBDOMAINS.includes(subdomain)) {
		return json({ available: false, reason: 'reserved' } satisfies SubdomainCheckResponse);
	}

	// Check database for existing organization
	if (!platform?.env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const existing = await getOrganizationBySubdomain(platform.env.DB, subdomain);

	if (existing) {
		return json({ available: false, reason: 'taken' } satisfies SubdomainCheckResponse);
	}

	return json({ available: true } satisfies SubdomainCheckResponse);
};
