// API endpoint for organization i18n settings (Issue #185)
// GET /api/organizations/[id] - Get organization details
// PATCH /api/organizations/[id] - Update organization i18n settings

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAuthenticatedMember, assertAdmin } from '$lib/server/auth/middleware';
import { updateOrganization, getOrganizationById } from '$lib/server/db/organizations';
import type { UpdateOrganizationInput } from '$lib/types';

interface OrgUpdateBody {
	language?: string | null;
	locale?: string | null;
	timezone?: string | null;
}

export async function GET(event: RequestEvent) {
	const { params, platform, cookies, locals } = event;
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Security: verify params.id matches current org
	if (params.id !== locals.org.id) {
		throw error(403, 'Cannot view other organizations');
	}

	const org = await getOrganizationById(db, params.id);
	if (!org) {
		throw error(404, 'Organization not found');
	}

	return json(org);
}

export async function PATCH(event: RequestEvent) {
	const { params, request, platform, cookies, locals } = event;
	if (!platform) throw error(500, 'Platform not available');
	const db = platform.env.DB;

	// Require admin role
	const member = await getAuthenticatedMember(db, cookies);
	assertAdmin(member);

	// Security: verify params.id matches current org
	if (params.id !== locals.org.id) {
		throw error(403, 'Cannot update other organizations');
	}

	const body = (await request.json()) as OrgUpdateBody;

	// Build update input with proper types
	const updateInput: UpdateOrganizationInput = {};
	if ('language' in body) updateInput.language = body.language;
	if ('locale' in body) updateInput.locale = body.locale;
	if ('timezone' in body) updateInput.timezone = body.timezone;

	// Update organization with i18n fields
	const updated = await updateOrganization(db, params.id!, updateInput);

	if (!updated) {
		throw error(404, 'Organization not found');
	}

	return json(updated);
}
