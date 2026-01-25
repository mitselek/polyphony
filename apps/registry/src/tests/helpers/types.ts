// Test helper types for SvelteKit route handlers

export interface TestRequestEvent<Params = Record<string, string>> {
	request?: Request;
	url?: URL;
	params?: Params;
	fetch?: any; // Vitest mock type incompatible with SvelteKit fetch
	platform?: {
		env: {
			DB: D1Database;
			API_KEY: string;
			GOOGLE_CLIENT_ID?: string;
			GOOGLE_CLIENT_SECRET?: string;
		};
	};
}

export interface TestPlatform {
	env: {
		DB: D1Database;
		API_KEY: string;
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
	};
}

export interface TestGetEvent {
	url?: URL;
	fetch?: any; // Vitest mock type incompatible with SvelteKit fetch
	platform?: TestPlatform;
}
