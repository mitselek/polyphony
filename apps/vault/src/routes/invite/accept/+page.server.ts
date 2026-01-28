import { redirect, error, type RequestEvent } from '@sveltejs/kit';

export async function load({ url, platform }: RequestEvent) {
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
`SELECT id, roster_member_id, expires_at, status, roles
 FROM invites
 WHERE token = ?`
)
.bind(token)
.first<{
id: string;
roster_member_id: string;
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

// Redirect to auth/login with invite token parameter
// The login endpoint will pass it through the OAuth flow
throw redirect(302, `/api/auth/login?invite=${encodeURIComponent(token)}`);
};
