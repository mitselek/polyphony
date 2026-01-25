// Test helper types for SvelteKit route handlers

// SvelteKit-compatible fetch type for tests
type TestFetch = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

export interface TestRequestEvent<Params = Record<string, string>> {
	request?: Request;
	url?: URL;
	params?: Params;
	fetch?: TestFetch;
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

export interface TestGetPlatform {
	env: {
		DB: D1Database;
		API_KEY?: string;
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
	};
}

export interface TestGetEvent {
	url?: URL;
	fetch?: TestFetch;
	platform?: TestGetPlatform;
}
