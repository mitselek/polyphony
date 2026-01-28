// GET /api/auth/login - Redirect to registry for OAuth
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const REGISTRY_URL = 'https://polyphony-registry.pages.dev';
const VAULT_ID = 'BQ6u9ENTnZk_danhhIbUB';

export const GET: RequestHandler = async ({ url }) => {
	// Check if there's an invite token to pass through
	const inviteToken = url.searchParams.get('invite');

	// Build callback URL (same origin as request)
	let callbackUrl = `${url.origin}/api/auth/callback`;
	if (inviteToken) {
		callbackUrl += `?invite=${encodeURIComponent(inviteToken)}`;
	}

	// Redirect to registry OAuth
	const registryAuthUrl = new URL('/auth', REGISTRY_URL);
	registryAuthUrl.searchParams.set('vault_id', VAULT_ID);
	registryAuthUrl.searchParams.set('callback', callbackUrl);

	return redirect(302, registryAuthUrl.toString());
};
