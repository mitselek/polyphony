// API endpoint for roster view
/// <reference types="@cloudflare/workers-types" />
import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getRosterView } from '$lib/server/db/roster';
import { getRosterQuerySchema } from '$lib/server/validation/schemas';
import { getAuthenticatedMember } from '$lib/server/auth/middleware';

/**
 * GET /api/events/roster
 * Returns roster view with events, members, and participation data
 * Requires: Authentication
 * 
 * Query parameters:
 * - start: ISO 8601 datetime (required) - Start date for event filter
 * - end: ISO 8601 datetime (required) - End date for event filter
 * - sectionId: string (optional) - Filter members by section
 */
export async function GET(event: RequestEvent) {
	const { platform, cookies, url } = event;
	if (!platform) throw new Error('Platform not available');
	const db = platform.env.DB;

	// Require authentication
	await getAuthenticatedMember(db, cookies);

	// Parse and validate query parameters
	const startParam = url.searchParams.get('start');
	const endParam = url.searchParams.get('end');
	const sectionIdParam = url.searchParams.get('sectionId');

	const queryParams: any = {};
	if (startParam) queryParams.start = startParam;
	if (endParam) queryParams.end = endParam;
	if (sectionIdParam) queryParams.sectionId = sectionIdParam;

	const result = getRosterQuerySchema.safeParse(queryParams);
	if (!result.success) {
		const errorMessage = result.error.issues?.[0]?.message || 'Invalid query parameters';
		throw error(400, errorMessage);
	}

	const { start, end, sectionId } = result.data;

	// Build filters for roster view
	const filters = {
		startDate: start,
		endDate: end,
		...(sectionId && { sectionId })
	};

	// Fetch roster data
	const roster = await getRosterView(db, filters);

	return json(roster);
}
