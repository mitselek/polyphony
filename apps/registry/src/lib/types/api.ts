// API response types for Registry endpoints

export interface ErrorResponse {
	error: string;
}

export interface OAuthInitResponse {
	authUrl: string;
}
