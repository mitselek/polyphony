# Registry Database

**Zero-storage principle**: Registry stores ONLY authentication-related data. It does NOT store organizations, users, or scores.

### Tables

#### signing_keys

EdDSA signing keys for JWT token generation.

| Column       | Type    | Constraints | Description                      |
| ------------ | ------- | ----------- | -------------------------------- |
| id           | INTEGER | PK          | Auto-increment ID                |
| public_key   | TEXT    | NOT NULL    | EdDSA public key (JWK format)    |
| private_key  | TEXT    | NOT NULL    | EdDSA private key (JWK format)   |
| key_id       | TEXT    | NOT NULL    | Key identifier for JWKS endpoint |
| created_at   | TEXT    | NOT NULL    | Creation timestamp               |
| activated_at | TEXT    |             | When key became active           |
| revoked_at   | TEXT    |             | When key was revoked             |

**Purpose**: Registry signs JWTs for OAuth flow. Vault verifies via `/.well-known/jwks.json`.

#### email_auth_codes

Magic link verification codes (5-minute TTL).

| Column     | Type | Constraints | Description                      |
| ---------- | ---- | ----------- | -------------------------------- |
| code       | TEXT | PK          | 6-digit verification code        |
| email      | TEXT | NOT NULL    | Email address                    |
| vault_name | TEXT | NOT NULL    | Subdomain (for email context)    |
| callback   | TEXT | NOT NULL    | Return URL after auth            |
| nonce      | TEXT | NOT NULL    | OAuth nonce for token validation |
| created_at | TEXT | NOT NULL    | Creation timestamp               |
| expires_at | TEXT | NOT NULL    | Expiration (5 minutes)           |

**Purpose**: Temporary codes for email-based auth flow.

#### email_rate_limits

Rate limiting for email sending (5 per hour per address).

| Column       | Type    | Constraints | Description            |
| ------------ | ------- | ----------- | ---------------------- |
| email        | TEXT    | PK          | Email address          |
| count        | INTEGER | DEFAULT 1   | Emails sent this hour  |
| window_start | TEXT    | NOT NULL    | Start of current hour  |
| updated_at   | TEXT    | NOT NULL    | Last update timestamp  |

**Purpose**: Prevent abuse of magic link emails.

**Discovery Data**: Registry queries Vault public APIs at runtime:

- Organization directory: `GET /api/public/organizations` (Vault)
- Public Domain scores: `GET /api/public/scores/pd` (Vault)
