// Organization database operations
// Part of Schema V2 multi-organization support

import type { Organization, CreateOrganizationInput, UpdateOrganizationInput } from '$lib/types';

// Simple ID generator (consistent with members.ts pattern)
function generateId(): string {
	return 'org_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Create a new organization
 */
export async function createOrganization(
	db: D1Database,
	input: CreateOrganizationInput
): Promise<Organization> {
	const id = generateId();
	const now = new Date().toISOString();

	await db
		.prepare(
			'INSERT INTO organizations (id, name, subdomain, type, contact_email, created_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(id, input.name, input.subdomain.toLowerCase(), input.type, input.contactEmail, now)
		.run();

	return {
		id,
		name: input.name,
		subdomain: input.subdomain.toLowerCase(),
		type: input.type,
		contactEmail: input.contactEmail,
		createdAt: now
	};
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
	db: D1Database,
	id: string
): Promise<Organization | null> {
	const row = await db
		.prepare('SELECT id, name, subdomain, type, contact_email, created_at FROM organizations WHERE id = ?')
		.bind(id)
		.first<OrganizationRow>();

	if (!row) {
		return null;
	}

	return mapRowToOrganization(row);
}

/**
 * Get organization by subdomain (used in routing)
 */
export async function getOrganizationBySubdomain(
	db: D1Database,
	subdomain: string
): Promise<Organization | null> {
	const row = await db
		.prepare('SELECT id, name, subdomain, type, contact_email, created_at FROM organizations WHERE subdomain = ?')
		.bind(subdomain.toLowerCase())
		.first<OrganizationRow>();

	if (!row) {
		return null;
	}

	return mapRowToOrganization(row);
}

/**
 * Get all organizations
 */
export async function getAllOrganizations(db: D1Database): Promise<Organization[]> {
	const { results } = await db
		.prepare('SELECT id, name, subdomain, type, contact_email, created_at FROM organizations ORDER BY name')
		.all<OrganizationRow>();

	return results.map(mapRowToOrganization);
}

/**
 * Update organization (name and/or contact email only - subdomain and type are immutable)
 */
export async function updateOrganization(
	db: D1Database,
	id: string,
	input: UpdateOrganizationInput
): Promise<Organization | null> {
	// Build dynamic UPDATE statement based on provided fields
	const updates: string[] = [];
	const params: (string | null)[] = [];

	if (input.name !== undefined) {
		updates.push('name = ?');
		params.push(input.name);
	}

	if (input.contactEmail !== undefined) {
		updates.push('contact_email = ?');
		params.push(input.contactEmail);
	}

	if (updates.length === 0) {
		// Nothing to update, just return existing organization
		return getOrganizationById(db, id);
	}

	params.push(id); // WHERE clause parameter

	const result = await db
		.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`)
		.bind(...params)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return null;
	}

	return getOrganizationById(db, id);
}

// =============================================================================
// Internal types and helpers
// =============================================================================

interface OrganizationRow {
	id: string;
	name: string;
	subdomain: string;
	type: 'umbrella' | 'collective';
	contact_email: string;
	created_at: string;
}

function mapRowToOrganization(row: OrganizationRow): Organization {
	return {
		id: row.id,
		name: row.name,
		subdomain: row.subdomain,
		type: row.type,
		contactEmail: row.contact_email,
		createdAt: row.created_at
	};
}
