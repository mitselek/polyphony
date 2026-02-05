// OAuth callback endpoint
// GET /auth/callback?code=xxx&state=xxx
/// <reference types="@cloudflare/workers-types" />
import { signToken } from '@polyphony/shared/crypto';
import { nanoid } from 'nanoid';

// SSO cookie constants
const SSO_COOKIE_NAME = 'polyphony_sso';
const SSO_COOKIE_DOMAIN = '.polyphony.uk';
const SSO_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface CloudflarePlatform {
	env: {
		DB: D1Database;
		API_KEY: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
	};
}

interface GoogleTokenResponse {
	access_token: string;
	id_token: string;
}

interface GoogleUserInfo {
	email: string;
	name?: string;
	picture?: string;
}

export const GET = async ({
	url,
	platform,
	fetch
}: {
	url: URL;
	platform?: CloudflarePlatform;
	fetch: typeof globalThis.fetch;
}) => {
	if (!platform) throw new Error('Platform not available');

	const code = url.searchParams.get('code');
	const stateParam = url.searchParams.get('state');

	if (!code) {
		return new Response('Missing authorization code', { status: 400 });
	}

	if (!stateParam) {
		return new Response('Missing state parameter', { status: 400 });
	}

	const state = JSON.parse(stateParam) as { vaultId: string; callbackUrl: string };

	// Exchange authorization code for tokens
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: platform.env.GOOGLE_CLIENT_ID,
			client_secret: platform.env.GOOGLE_CLIENT_SECRET,
			redirect_uri: `${url.origin}/auth/callback`,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenResponse.ok) {
		return new Response('Failed to exchange authorization code', { status: 400 });
	}

	const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

	// Fetch user info from Google
	const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});

	const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

	// Fetch active signing key
	const signingKey = await platform.env.DB.prepare(
		'SELECT id, private_key FROM signing_keys WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1'
	).first();

	if (!signingKey) {
		return new Response('No active signing key', { status: 500 });
	}

	// Create JWT for vault (includes vault-specific claims)
	const vaultToken = await signToken(
		{
			iss: 'https://polyphony.uk',
			sub: userInfo.email,
			aud: state.vaultId,
			nonce: nanoid(),
			email: userInfo.email,
			name: userInfo.name,
			picture: userInfo.picture
		},
		signingKey.private_key as string
	);

	// Create SSO token for cross-vault convenience (simpler claims)
	const ssoToken = await signToken(
		{
			iss: 'https://polyphony.uk',
			sub: userInfo.email,
			aud: 'polyphony-sso',
			nonce: nanoid(),
			email: userInfo.email,
			name: userInfo.name,
			picture: userInfo.picture
		},
		signingKey.private_key as string
	);

	// Build SSO cookie
	const ssoCookie = [
		`${SSO_COOKIE_NAME}=${ssoToken}`,
		`Domain=${SSO_COOKIE_DOMAIN}`,
		'Path=/',
		'HttpOnly',
		'Secure',
		'SameSite=Lax',
		`Max-Age=${SSO_COOKIE_MAX_AGE}`
	].join('; ');

	// Redirect to vault callback with token and set SSO cookie
	const callbackUrl = new URL(state.callbackUrl);
	callbackUrl.searchParams.set('token', vaultToken);

	return new Response(null, {
		status: 302,
		headers: {
			Location: callbackUrl.toString(),
			'Set-Cookie': ssoCookie
		}
	});
};
