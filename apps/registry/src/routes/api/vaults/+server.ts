// Vault registration API
/// <reference types="@cloudflare/workers-types" />
import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';

interface CloudflarePlatform {
	env: { DB: D1Database; API_KEY: string };
}

function checkAuth(request: Request, apiKey: string): boolean {
	const providedKey = request.headers.get('X-API-Key');
	return providedKey === apiKey;
}

export const POST = async ({ request, platform }: { request: Request; platform?: CloudflarePlatform }) => {
	if (!platform) throw new Error('Platform not available');

	// Check API key
	if (!checkAuth(request, platform.env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse request body
	const body = await request.json() as { name?: string; callback_url?: string };

	// Validate required fields
	if (!body.name) {
		return json({ error: 'Missing required field: name' }, { status: 400 });
	}

	if (!body.callback_url) {
		return json({ error: 'Missing required field: callback_url' }, { status: 400 });
	}

	// Validate HTTPS callback URL
	if (!body.callback_url.startsWith('https://')) {
		return json({ error: 'Callback URL must use HTTPS' }, { status: 400 });
	}

	// Check for duplicate name
	const existing = await platform.env.DB.prepare('SELECT name FROM vaults WHERE name = ?')
		.bind(body.name)
		.first();

	if (existing) {
		return json({ error: 'Vault with this name already exists' }, { status: 409 });
	}

	// Generate vault ID
	const vaultId = nanoid();

	// Insert vault
	await platform.env.DB.prepare(
		'INSERT INTO vaults (id, name, callback_url, active) VALUES (?, ?, ?, 1)'
	)
		.bind(vaultId, body.name, body.callback_url)
		.run();

	return json(
		{
			id: vaultId,
			name: body.name,
			callback_url: body.callback_url,
			active: true
		},
		{ status: 201 }
	);
};

export const GET = async ({ request, platform }: { request: Request; platform?: CloudflarePlatform }) => {
	if (!platform) throw new Error('Platform not available');

	// Check API key
	if (!checkAuth(request, platform.env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Fetch all vaults
	const { results } = await platform.env.DB.prepare(
		'SELECT id, name, callback_url, active, created_at FROM vaults ORDER BY created_at DESC'
	).all();

	return json({ vaults: results });
};
