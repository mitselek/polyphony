// OAuth callback endpoint
// GET /auth/callback?code=xxx&state=xxx
/// <reference types="@cloudflare/workers-types" />
import { redirect } from '@sveltejs/kit';
import { signToken } from '@polyphony/shared/crypto';
import { nanoid } from 'nanoid';

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

	// Create JWT
	const token = await signToken(
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

	// Redirect to vault callback with token
	const callbackUrl = new URL(state.callbackUrl);
	callbackUrl.searchParams.set('token', token);

	return redirect(302, callbackUrl.toString());
};
