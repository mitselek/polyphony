// Public API: Organization management for Registry
// GET /api/public/organizations - List all organizations (for directory)
// POST /api/public/organizations - Create new organization (for registration)
// No authentication required - used by Registry

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOrganization, getAllOrganizations } from '$lib/server/db/organizations';
import type { CreateOrganizationInput } from '$lib/types';

/**
 * GET /api/public/organizations
 * Returns list of all organizations for Registry directory
 */
export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const organizations = await getAllOrganizations(platform.env.DB);
	
	return json({
		organizations: organizations.map(org => ({
			id: org.id,
			name: org.name,
			subdomain: org.subdomain,
			type: org.type,
			contactEmail: org.contactEmail,
			createdAt: org.createdAt
		}))
	});
};

/**
 * POST /api/public/organizations
 * Creates a new organization
 * Called by Registry during registration flow
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	// Validate required fields
	if (!body || typeof body !== 'object') {
		throw error(400, 'Request body must be an object');
	}

	const input = body as Record<string, unknown>;

	if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
		throw error(400, 'Missing or invalid field: name');
	}

	if (!input.subdomain || typeof input.subdomain !== 'string' || input.subdomain.trim() === '') {
		throw error(400, 'Missing or invalid field: subdomain');
	}

	if (!input.type || (input.type !== 'collective' && input.type !== 'umbrella')) {
		throw error(400, 'Invalid field: type (must be "collective" or "umbrella")');
	}

	if (!input.contactEmail || typeof input.contactEmail !== 'string' || input.contactEmail.trim() === '') {
		throw error(400, 'Missing or invalid field: contactEmail');
	}

	// Construct validated input
	const orgInput: CreateOrganizationInput = {
		name: input.name.trim(),
		subdomain: input.subdomain.trim().toLowerCase(),
		type: input.type,
		contactEmail: input.contactEmail.trim()
	};

	// Create organization
	try {
		const organization = await createOrganization(platform.env.DB, orgInput);
		return json({ organization }, { status: 201 });
	} catch (err) {
		// Handle unique constraint violations
		if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
			throw error(409, 'Organization with this subdomain already exists');
		}
		throw err;
	}
};
