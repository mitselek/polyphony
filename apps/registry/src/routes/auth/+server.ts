// OAuth initiation endpoint
// GET /auth?vault_id=xxx&callback=https://vault.../callback
/// <reference types="@cloudflare/workers-types" />
import { json, redirect } from '@sveltejs/kit';

interface CloudflarePlatform {
	env: { DB: D1Database; API_KEY: string; GOOGLE_CLIENT_ID: string };
}

export const GET = async ({ url, platform }: { url: URL; platform?: CloudflarePlatform }) => {
	if (!platform) throw new Error('Platform not available');

	const vaultId = url.searchParams.get('vault_id');
	const callbackUrl = url.searchParams.get('callback');

	// Validate required parameters
	if (!vaultId) {
		return json({ error: 'Missing vault_id parameter' }, { status: 400 });
	}

	if (!callbackUrl) {
		return json({ error: 'Missing callback parameter' }, { status: 400 });
	}

	// Verify vault exists and is active
	const vault = await platform.env.DB.prepare(
		'SELECT id, callback_url, active FROM vaults WHERE id = ? AND active = 1'
	)
		.bind(vaultId)
		.first();

	if (!vault) {
		return json({ error: 'Vault not registered' }, { status: 400 });
	}

	// Verify callback URL matches registered callback
	if (vault.callback_url !== callbackUrl) {
		return json({ error: 'Invalid callback URL' }, { status: 400 });
	}

	// Build Google OAuth URL
	const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	googleAuthUrl.searchParams.set('client_id', platform.env.GOOGLE_CLIENT_ID);
	googleAuthUrl.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
	googleAuthUrl.searchParams.set('response_type', 'code');
	googleAuthUrl.searchParams.set('scope', 'openid email profile');
	googleAuthUrl.searchParams.set('state', JSON.stringify({ vaultId, callbackUrl }));

	return redirect(302, googleAuthUrl.toString());
};
