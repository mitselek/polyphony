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
			`SELECT id, name, expires_at, status, roles, voice_part
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
			voice_part: string | null;
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
	const registryAuthUrl = platform?.env?.REGISTRY_OAUTH_URL || 'http://localhost:5174/oauth/authorize';
	const vaultUrl = url.origin;
	const callbackUrl = `${vaultUrl}/api/auth/callback`;
	
	// Build OAuth URL with required parameters
	const oauthUrl = new URL(registryAuthUrl);
	oauthUrl.searchParams.set('response_type', 'code');
	oauthUrl.searchParams.set('client_id', platform?.env?.REGISTRY_CLIENT_ID || 'vault');
	oauthUrl.searchParams.set('redirect_uri', callbackUrl);
	oauthUrl.searchParams.set('scope', 'profile email');
	
	throw redirect(302, oauthUrl.toString());
};
