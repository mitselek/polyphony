// API response types for Registry endpoints

export interface VaultResponse {
	id: string;
	name: string;
	callback_url: string;
	active: number;
	registered_at: string;
}

export interface VaultListResponse {
	vaults: VaultResponse[];
}

export interface ErrorResponse {
	error: string;
}

export interface OAuthInitResponse {
	authUrl: string;
}
