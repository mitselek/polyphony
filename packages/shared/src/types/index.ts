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
