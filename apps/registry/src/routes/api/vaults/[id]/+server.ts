// Individual vault operations
/// <reference types="@cloudflare/workers-types" />
import { json } from '@sveltejs/kit';

interface CloudflarePlatform {
	env: { DB: D1Database; API_KEY: string };
}

function checkAuth(request: Request, apiKey: string): boolean {
	const providedKey = request.headers.get('X-API-Key');
	return providedKey === apiKey;
}

export const GET = async ({
	request,
	params,
	platform
}: {
	request: Request;
	params: { id: string };
	platform?: CloudflarePlatform;
}) => {
	if (!platform) throw new Error('Platform not available');

	// Check API key
	if (!checkAuth(request, platform.env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Fetch vault
	const vault = await platform.env.DB.prepare(
		'SELECT id, name, callback_url, active, registered_at FROM vaults WHERE id = ?'
	)
		.bind(params.id)
		.first();

	if (!vault) {
		return json({ error: 'Vault not found' }, { status: 404 });
	}

	return json(vault);
};

export const PUT = async ({
	request,
	params,
	platform
}: {
	request: Request;
	params: { id: string };
	platform?: CloudflarePlatform;
}) => {
	if (!platform) throw new Error('Platform not available');

	// Check API key
	if (!checkAuth(request, platform.env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse request body
	const body = (await request.json()) as { callback_url?: string };

	if (!body.callback_url) {
		return json({ error: 'Missing callback_url' }, { status: 400 });
	}

	// Validate HTTPS
	if (!body.callback_url.startsWith('https://')) {
		return json({ error: 'Callback URL must use HTTPS' }, { status: 400 });
	}

	// Update vault
	await platform.env.DB.prepare('UPDATE vaults SET callback_url = ? WHERE id = ?')
		.bind(body.callback_url, params.id)
		.run();

	// Return updated vault
	const vault = await platform.env.DB.prepare(
		'SELECT id, name, callback_url, active, created_at FROM vaults WHERE id = ?'
	)
		.bind(params.id)
		.first();

	return json(vault);
};

export const DELETE = async ({
	request,
	params,
	platform
}: {
	request: Request;
	params: { id: string };
	platform?: CloudflarePlatform;
}) => {
	if (!platform) throw new Error('Platform not available');

	// Check API key
	if (!checkAuth(request, platform.env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Deactivate vault (soft delete)
	await platform.env.DB.prepare('UPDATE vaults SET active = 0 WHERE id = ?')
		.bind(params.id)
		.run();

	return new Response(null, { status: 204 });
};
