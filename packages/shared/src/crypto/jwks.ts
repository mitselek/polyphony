// Convert Ed25519 PEM keys to JWKS format
import { importSPKI, exportJWK } from 'jose';

export interface JWK {
	kty: 'OKP';
	crv: 'Ed25519';
	x: string; // base64url-encoded public key
	kid: string; // key ID
	use: 'sig';
	alg: 'EdDSA';
}

export interface JWKS {
	keys: JWK[];
}

/**
 * Convert Ed25519 PEM public key to JWK format
 * @param publicKeyPem - PEM-formatted Ed25519 public key
 * @param keyId - Key identifier (kid)
 * @returns JWK object
 */
export async function pemToJwk(publicKeyPem: string, keyId: string): Promise<JWK> {
	// Import the PEM key
	const publicKey = await importSPKI(publicKeyPem, 'EdDSA');

	// Export as JWK
	const jwk = await exportJWK(publicKey);

	return {
		kty: 'OKP',
		crv: 'Ed25519',
		x: jwk.x!,
		kid: keyId,
		use: 'sig',
		alg: 'EdDSA'
	};
}
