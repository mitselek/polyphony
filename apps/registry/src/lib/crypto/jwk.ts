/**
 * JWK to PEM conversion utilities
 * Used for Ed25519 public key verification
 */

/**
 * Convert JWK to PEM format for jose verification
 * Specifically handles Ed25519 (EdDSA) public keys in JWK format
 */
export function jwkToPem(jwk: { x: string }): string {
	// Ed25519 public key is 32 bytes, x coordinate is base64url encoded
	const xBytes = base64UrlDecode(jwk.x);

	// SPKI format for Ed25519:
	// OID 1.3.101.112 = Ed25519
	const oid = new Uint8Array([0x06, 0x03, 0x2b, 0x65, 0x70]);
	const algoId = new Uint8Array([0x30, 0x05, ...oid]);
	const pubKeyBits = new Uint8Array([0x03, 0x21, 0x00, ...xBytes]);
	const spki = new Uint8Array([0x30, 0x2a, ...algoId, ...pubKeyBits]);

	// Convert to PEM format
	const base64 = btoa(String.fromCharCode(...spki));
	return (
		'-----BEGIN PUBLIC KEY-----\n' +
		base64.match(/.{1,64}/g)!.join('\n') +
		'\n-----END PUBLIC KEY-----'
	);
}

/**
 * Decode base64url to Uint8Array
 * Handles URL-safe base64 encoding (- and _ characters)
 */
export function base64UrlDecode(str: string): Uint8Array {
	// Convert base64url to standard base64
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	// Add padding if needed
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}
