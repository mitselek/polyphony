// Vault settings database operations
// Settings are stored as key-value pairs with audit trail

export interface VaultSetting {
	key: string;
	value: string;
	updated_by: string | null;
	updated_at: string;
}

/**
 * Get a setting value by key
 * Returns null if the setting doesn't exist
 */
export async function getSetting(db: D1Database, key: string): Promise<string | null> {
	const row = await db
		.prepare('SELECT value FROM vault_settings WHERE key = ?')
		.bind(key)
		.first<{ value: string }>();

	return row?.value ?? null;
}

/**
 * Set a setting value (creates or updates)
 * @param updated_by - Member ID who made the change (optional)
 */
export async function setSetting(
	db: D1Database,
	key: string,
	value: string,
	updated_by?: string
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO vault_settings (key, value, updated_by) VALUES (?, ?, ?) ' +
			'ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP'
		)
		.bind(key, value, updated_by ?? null)
		.run();
}

/**
 * Get all settings as a key-value object
 */
export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
	const { results } = await db
		.prepare('SELECT key, value FROM vault_settings')
		.all<{ key: string; value: string }>();

	const settings: Record<string, string> = {};
	for (const row of results) {
		settings[row.key] = row.value;
	}

	return settings;
}
