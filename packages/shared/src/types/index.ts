// Shared TypeScript types for Polyphony

/**
 * Auth token issued by Registry, verified by Vaults
 */
export interface AuthToken {
  /** Issuer - Registry URL */
  iss: string;
  /** Subject - User's email */
  sub: string;
  /** Audience - Vault ID that requested auth */
  aud: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp (short-lived: 5 minutes) */
  exp: number;
  /** Nonce for replay protection */
  nonce: string;
  /** User's email (custom claim, matches sub for clarity) */
  email: string;
  /** User's display name (from OAuth) */
  name?: string;
  /** User's profile picture URL (from OAuth) */
  picture?: string;
}

/**
 * Registered Vault in Registry
 */
export interface RegisteredVault {
  id: string;
  name: string;
  callbackUrl: string;
  registeredAt: string;
  active: boolean;
}

/**
 * Result of token verification
 */
export interface VerifiedToken {
  email: string;
  name?: string;
  picture?: string;
  nonce: string;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// =============================================================================
// Email Authentication (Issue #156)
// =============================================================================

/**
 * Request body for POST /auth/email
 */
export interface EmailAuthRequest {
  /** User's email address */
  email: string;
  /** Vault ID requesting authentication */
  vault_id: string;
  /** Callback URL for token delivery (must match registered URL) */
  callback: string;
}

/**
 * Response from POST /auth/email
 */
export interface EmailAuthResponse {
  /** Whether the request was accepted */
  success: boolean;
  /** User-facing message */
  message?: string;
  /** Error message (if success=false) */
  error?: string;
}

/**
 * Stored email auth code record
 */
export interface EmailAuthCode {
  id: string;
  email: string;
  code: string;
  vaultId: string;
  callbackUrl: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}
