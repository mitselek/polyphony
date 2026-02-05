// Logout endpoint - clears SSO cookie
// GET/POST /auth/logout?callback=xxx

// SSO cookie constants (must match callback/+server.ts)
const SSO_COOKIE_NAME = 'polyphony_sso';
const SSO_COOKIE_DOMAIN = '.polyphony.uk';
const DEFAULT_REDIRECT = 'https://polyphony.uk';

interface LogoutRequestEvent {
	url: URL;
	cookies: {
		delete: (name: string, opts: object) => void;
	};
}

/**
 * Validate callback URL for security (prevent open redirect)
 * Only allows polyphony.uk and its subdomains
 */
function isValidCallback(callback: string): boolean {
	try {
		const url = new URL(callback);
		// Must be https and on polyphony.uk domain
		return (
			url.protocol === 'https:' &&
			(url.hostname === 'polyphony.uk' || url.hostname.endsWith('.polyphony.uk'))
		);
	} catch {
		return false;
	}
}

/**
 * Handle logout - clear SSO cookie and redirect
 */
function handleLogout({ url, cookies }: LogoutRequestEvent): Response {
	// Clear SSO cookie
	cookies.delete(SSO_COOKIE_NAME, {
		domain: SSO_COOKIE_DOMAIN,
		path: '/'
	});

	// Get callback URL (validated for security)
	const callback = url.searchParams.get('callback');
	const redirectUrl = callback && isValidCallback(callback) ? callback : DEFAULT_REDIRECT;

	return new Response(null, {
		status: 302,
		headers: { Location: redirectUrl }
	});
}

// Support both GET (logout links) and POST (form submissions)
export const GET = handleLogout;
export const POST = handleLogout;
