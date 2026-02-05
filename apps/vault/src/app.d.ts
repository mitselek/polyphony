// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Organization } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			org: Organization; // Set by hooks.server.ts via subdomain routing
		}
		interface Platform {
			env: {
				DB: D1Database;
				STORAGE: R2Bucket;
				REGISTRY_CLIENT_ID: string;
				REGISTRY_CLIENT_SECRET: string;
				REGISTRY_OAUTH_URL: string;
				SESSION_SECRET: string;
				VAULT_ID: string;
				// Email notifications (#202)
				RESEND_API_KEY?: string;
				ADMIN_EMAIL?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
