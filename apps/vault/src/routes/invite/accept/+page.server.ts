import { redirect, error, type RequestEvent } from '@sveltejs/kit';

export async function load({ url, platform, cookies }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Invalid invitation link');
	}

	// Validate token and check expiration
	const invite = await db
		.prepare(
			`SELECT id, name, expires_at, status, roles
			 FROM invites
			 WHERE token = ?`
		)
		.bind(token)
		.first<{
			id: string;
			name: string;
			expires_at: string;
			status: string;
			roles: string;
		}>();

	if (!invite) {
		throw error(404, 'Invitation not found');
	}

	if (invite.status !== 'pending') {
		throw error(400, 'This invitation has already been used');
	}

	const now = new Date();
	const expiresAt = new Date(invite.expires_at);
	if (now > expiresAt) {
		throw error(400, 'This invitation has expired');
	}

	// Store the token in a cookie so we can retrieve it after OAuth redirect
	cookies.set('invite_token', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 30 // 30 minutes - enough time to complete OAuth
	});

	// Redirect to registry OAuth
	const registryUrl = platform?.env?.REGISTRY_OAUTH_URL || 'http://localhost:5174';
	const vaultUrl = url.origin;
	const callbackUrl = `${vaultUrl}/api/auth/callback`;
	const vaultId = 'BQ6u9ENTnZk_danhhIbUB'; // TODO: Make configurable
	
	// Build registry auth URL with vault_id and callback parameters
	const authUrl = new URL(`${registryUrl}/auth`);
	authUrl.searchParams.set('vault_id', vaultId);
	authUrl.searchParams.set('callback', callbackUrl);
	
	throw redirect(302, authUrl.toString());
};
