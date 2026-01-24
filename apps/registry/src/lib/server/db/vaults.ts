// Vault database operations
import { nanoid } from 'nanoid';

interface VaultInput {
	name: string;
	callback_url: string;
}

interface Vault {
	id: string;
	name: string;
	callback_url: string;
	registered_at: string;
	active: number;
}

export async function registerVault(db: D1Database, input: VaultInput): Promise<Vault> {
	// Validate HTTPS
	if (!input.callback_url.startsWith('https://')) {
		throw new Error('callback_url must use HTTPS');
	}

	// Check for duplicate name
	const existing = await db
		.prepare('SELECT id FROM vaults WHERE name = ?')
		.bind(input.name)
		.first<{ id: string }>();

	if (existing) {
		throw new Error('Vault name already exists');
	}

	const id = nanoid();
	const now = new Date().toISOString();

	await db
		.prepare('INSERT INTO vaults (id, name, callback_url, registered_at, active) VALUES (?, ?, ?, ?, 1)')
		.bind(id, input.name, input.callback_url, now)
		.run();

	return {
		id,
		name: input.name,
		callback_url: input.callback_url,
		registered_at: now,
		active: 1
	};
}

export async function getVault(db: D1Database, id: string): Promise<Vault | null> {
	const result = await db
		.prepare('SELECT * FROM vaults WHERE id = ?')
		.bind(id)
		.first<Vault>();

	return result || null;
}

export async function updateVault(
	db: D1Database,
	id: string,
	updates: Partial<VaultInput>
): Promise<Vault> {
	if (updates.callback_url && !updates.callback_url.startsWith('https://')) {
		throw new Error('callback_url must use HTTPS');
	}

	if (updates.callback_url) {
		await db
			.prepare('UPDATE vaults SET callback_url = ? WHERE id = ?')
			.bind(updates.callback_url, id)
			.run();
	}

	if (updates.name) {
		await db
			.prepare('UPDATE vaults SET name = ? WHERE id = ?')
			.bind(updates.name, id)
			.run();
	}

	const updated = await getVault(db, id);
	if (!updated) {
		throw new Error('Vault not found');
	}

	return updated;
}

export async function deactivateVault(db: D1Database, id: string): Promise<void> {
	await db
		.prepare('UPDATE vaults SET active = 0 WHERE id = ?')
		.bind(id)
		.run();
}
