// GET /api/auth/login - Redirect to registry for OAuth
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const REGISTRY_URL = 'https://polyphony-registry.pages.dev';
const VAULT_ID = 'BQ6u9ENTnZk_danhhIbUB';

export const GET: RequestHandler = async ({ url, cookies }) => {
	// Check if there's an invite token to pass through
	const inviteToken = url.searchParams.get('invite');

	// Store invite token in cookie if present (callback will read it)
	if (inviteToken) {
		cookies.set('pending_invite', inviteToken, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 10 // 10 minutes
		});
	}

	// Build callback URL - must match registered URL exactly (no query params)
	const callbackUrl = `${url.origin}/api/auth/callback`;

	// Redirect to registry OAuth
	const registryAuthUrl = new URL('/auth', REGISTRY_URL);
	registryAuthUrl.searchParams.set('vault_id', VAULT_ID);
	registryAuthUrl.searchParams.set('callback', callbackUrl);

	return redirect(302, registryAuthUrl.toString());
};
