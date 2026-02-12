// Shared TypeScript types for Polyphony

// =============================================================================
// Branded Types (compile-time safety for IDs)
// =============================================================================

/**
 * Branded type for organization IDs.
 * Prevents accidentally passing member IDs, session tokens, etc.
 * where an org ID is expected.
 * 
 * Usage: createOrgId(locals.org.id) at the boundary (middleware/route handler),
 * then pass the branded value through DB functions.
 */
export type OrgId = string & { readonly __brand: 'OrgId' };

/**
 * Create a branded OrgId from a plain string.
 * Use at trust boundaries (middleware, route handlers) — NOT in DB functions.
 */
export function createOrgId(id: string): OrgId {
	return id as OrgId;
}

// =============================================================================
// Auth & Token Types
// =============================================================================

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
