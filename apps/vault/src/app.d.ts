// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				STORAGE: R2Bucket;
				REGISTRY_CLIENT_ID: string;
				REGISTRY_CLIENT_SECRET: string;
				REGISTRY_OAUTH_URL: string;
				SESSION_SECRET: string;
				VAULT_ID: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
