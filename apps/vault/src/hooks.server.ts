// Server hooks for subdomain-based organization routing
// Implements #165 - Schema V2 multi-organization support
// Implements #188 - i18n Paraglide integration

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getOrganizationBySubdomain } from '$lib/server/db/organizations';
import { resolvePreferences } from '$lib/server/i18n/preferences';
import { locales } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

// Development fallback subdomain (for localhost:5173 without subdomain)
const DEV_SUBDOMAIN = 'crede';

// Subdomains to skip (not organization routing)
const SKIP_SUBDOMAINS = new Set(['www', 'api', 'static', 'vault']);

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

// Organization routing handle
const orgHandle: Handle = async ({ event, resolve }) => {
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

// Locale resolution handle - syncs DB language preference with Paraglide cookie
// Runs after orgHandle (org is resolved) and before paraglideHandle
const localeHandle: Handle = async ({ event, resolve }) => {
	const db = event.platform?.env?.DB;
	const org = event.locals.org;
	if (!db || !org) {
		return resolve(event);
	}

	// Check if user already has a PARAGLIDE_LOCALE cookie set
	const existingCookie = event.cookies.get('PARAGLIDE_LOCALE');
	if (existingCookie && (locales as readonly string[]).includes(existingCookie)) {
		return resolve(event);
	}

	// Resolve effective language from member prefs → org settings → system default
	const memberId = event.cookies.get('member_id') ?? null;
	const prefs = await resolvePreferences(db, memberId, org.id);

	// Only inject if language is a valid Paraglide locale
	if (prefs.language && (locales as readonly string[]).includes(prefs.language)) {
		// Set the cookie for Paraglide to pick up (and for future requests)
		event.cookies.set('PARAGLIDE_LOCALE', prefs.language, {
			path: '/',
			maxAge: 60 * 60 * 24 * 400,
			httpOnly: false,
			sameSite: 'lax'
		});

		// Also inject into the request headers so paraglideMiddleware sees it
		// on this same request (cookie.set only affects the response).
		// Cloudflare Workers have immutable request headers, so we must
		// create a new Request object with the updated cookie header.
		const cookieHeader = event.request.headers.get('cookie') ?? '';
		const updatedCookies = cookieHeader
			? `${cookieHeader}; PARAGLIDE_LOCALE=${prefs.language}`
			: `PARAGLIDE_LOCALE=${prefs.language}`;
		const newHeaders = new Headers(event.request.headers);
		newHeaders.set('cookie', updatedCookies);
		event.request = new Request(event.request.url, {
			method: event.request.method,
			headers: newHeaders,
			body: event.request.body,
			redirect: event.request.redirect
		});
	}

	return resolve(event);
};

// Paraglide i18n handle - transforms page with locale
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

// Chain handles: org routing → locale resolution → paraglide i18n
export const handle: Handle = sequence(orgHandle, localeHandle, paraglideHandle);
