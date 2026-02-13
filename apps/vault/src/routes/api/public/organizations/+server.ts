// Public API: Organization management for Registry
// GET /api/public/organizations - List all organizations (for directory)
// POST /api/public/organizations - Create new organization (for registration)
// No authentication required - used by Registry

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOrganization, getAllOrganizations } from '$lib/server/db/organizations';
import { registerSubdomain } from '$lib/server/cloudflare/domains';
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
 * Validate a required string field
 */
function validateStringField(input: Record<string, unknown>, fieldName: string): string {
	const value = input[fieldName];
	if (!value || typeof value !== 'string' || value.trim() === '') {
		throw error(400, `Missing or invalid field: ${fieldName}`);
	}
	return value.trim();
}

/**
 * Parse and validate organization creation request body
 */
function parseOrgCreationInput(body: unknown): CreateOrganizationInput {
	if (!body || typeof body !== 'object') {
		throw error(400, 'Request body must be an object');
	}

	const input = body as Record<string, unknown>;

	const name = validateStringField(input, 'name');
	const subdomain = validateStringField(input, 'subdomain');
	const contactEmail = validateStringField(input, 'contactEmail');

	if (!input.type || (input.type !== 'collective' && input.type !== 'umbrella')) {
		throw error(400, 'Invalid field: type (must be "collective" or "umbrella")');
	}

	return {
		name,
		subdomain: subdomain.toLowerCase(),
		type: input.type,
		contactEmail
	};
}

async function performOrganizationCreation(db: D1Database, orgInput: CreateOrganizationInput, env: {
	CF_ACCOUNT_ID?: string;
	CF_API_TOKEN?: string;
	CF_PAGES_PROJECT?: string;
}) {
	const organization = await createOrganization(db, orgInput);

	const domainResult = await registerSubdomain(orgInput.subdomain, {
		CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
		CF_API_TOKEN: env.CF_API_TOKEN,
		CF_PAGES_PROJECT: env.CF_PAGES_PROJECT
	});

	if (!domainResult.success) {
		console.error('[Org Creation] Domain registration failed:', domainResult.error);
	} else {
		console.log('[Org Creation] Domain registered:', domainResult.domain, domainResult.status);
	}

	return organization;
}

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

	const orgInput = parseOrgCreationInput(body);

	try {
		const organization = await performOrganizationCreation(
			platform.env.DB, 
			orgInput, 
			{
				CF_ACCOUNT_ID: platform.env.CF_ACCOUNT_ID,
				CF_API_TOKEN: platform.env.CF_API_TOKEN,
				CF_PAGES_PROJECT: platform.env.CF_PAGES_PROJECT
			}
		);

		return json({ organization }, { status: 201 });
	} catch (err) {
		console.error('[Org Creation] Error:', err);
		if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
			throw error(409, 'Organization with this subdomain already exists');
		}
		throw error(500, err instanceof Error ? err.message : 'Failed to create organization');
	}
};
