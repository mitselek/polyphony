# Phase 0 Acceptance Testing

Manual validation of Epic #11 acceptance criteria. Each test will be performed live against the Registry app.

## Test Environment Setup

```bash
cd /home/michelek/Documents/github/polyphony/apps/registry

# Start Wrangler dev server with D1 binding
pnpm run dev
# Server running at: http://localhost:8788
```

## Acceptance Criteria Tests

### ✅ AC1: OAuth login produces valid JWT

**Test Steps**:

1. Register a test vault
2. Initiate OAuth flow from vault
3. Complete Google OAuth
4. Verify JWT is returned in callback

**Commands**:

```bash
# 1. Register test vault (save vault_id from response)
curl -X POST http://localhost:8788/api/vaults \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "name": "Test Choir",
    "callback_url": "https://test-choir.example.com/auth/callback"
  }'

# 2. Initiate OAuth (open in browser)
# http://localhost:8788/auth?vault_id=<vault_id>

# 3. After OAuth, JWT will be in URL fragment:
# https://test-choir.example.com/auth/callback#token=eyJ...
```

**Expected**:

- ✅ Vault registration succeeds
- ✅ OAuth redirect to Google
- ✅ Callback with JWT in URL fragment
- ✅ JWT is properly formatted (3 base64url parts)

**Actual**: ******\_\_\_******

---

### ✅ AC2: JWT contains required claims

**Test Steps**:

1. Decode JWT from AC1
2. Verify all required claims present

**Commands**:

```bash
# Decode JWT (paste token from AC1)
TOKEN="<jwt_from_callback>"

# Decode header and payload
echo $TOKEN | cut -d'.' -f1 | base64 -d | jq .
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .
```

**Expected Claims**:

- ✅ `iss`: Registry URL (e.g., "http://localhost:8788")
- ✅ `sub`: User's Google email
- ✅ `aud`: vault_id from registration
- ✅ `exp`: Unix timestamp (~5 minutes from now)
- ✅ `iat`: Unix timestamp (issued at)
- ✅ `nonce`: Unique random string
- ✅ `email`: User's Google email (custom claim)
- ✅ `name` (optional): User's display name
- ✅ `picture` (optional): User's avatar URL

**Actual**: ******\_\_\_******

---

### ✅ AC3: JWKS endpoint exposes public key

**Test Steps**:

1. Request JWKS endpoint
2. Verify public key format

**Commands**:

```bash
# Fetch JWKS
curl http://localhost:8788/.well-known/jwks.json | jq .

# Should return:
# {
#   "keys": [
#     {
#       "kty": "OKP",
#       "crv": "Ed25519",
#       "x": "<base64url_encoded_public_key>",
#       "kid": "<key_id>"
#     }
#   ]
# }
```

**Expected**:

- ✅ Status: 200 OK
- ✅ Content-Type: application/json
- ✅ Cache-Control: public, max-age=3600
- ✅ `keys` array with at least one key
- ✅ Key has `kty="OKP"`, `crv="Ed25519"`, `x` (public key), `kid`

**Actual**: ******\_\_\_******

---

### ✅ AC4: Token expires in 5 minutes

**Test Steps**:

1. Get JWT from AC1
2. Decode exp claim
3. Calculate time diff from iat

**Commands**:

```bash
TOKEN="<jwt_from_callback>"

# Extract iat and exp
IAT=$(echo $TOKEN | cut -d'.' -f2 | base64 -d | jq -r .iat)
EXP=$(echo $TOKEN | cut -d'.' -f2 | base64 -d | jq -r .exp)

# Calculate expiry duration (should be 300 seconds = 5 minutes)
echo "Expiry duration: $(($EXP - $IAT)) seconds"

# Check when it expires
date -d @$EXP
```

**Expected**:

- ✅ exp - iat = 300 seconds (5 minutes)
- ✅ Token will expire in 5 minutes from issuance

**Actual**: ******\_\_\_******

---

### ✅ AC5: Invalid callback URLs rejected

**Test Steps**:

1. Try to register vault with HTTP callback (not HTTPS)
2. Try to register vault with invalid URL format

**Commands**:

```bash
# Test 1: HTTP callback (should fail)
curl -X POST http://localhost:8788/api/vaults \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "name": "Bad Vault HTTP",
    "callback_url": "http://bad-vault.example.com/callback"
  }'
# Expected: 400 Bad Request, "callback_url must use HTTPS"

# Test 2: Malformed URL (should fail)
curl -X POST http://localhost:8788/api/vaults \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "name": "Bad Vault Malformed",
    "callback_url": "not-a-valid-url"
  }'
# Expected: 400 Bad Request, "callback_url must be a valid URL"

# Test 3: HTTPS callback (should succeed)
curl -X POST http://localhost:8788/api/vaults \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "name": "Good Vault HTTPS",
    "callback_url": "https://good-vault.example.com/callback"
  }'
# Expected: 201 Created
```

**Expected**:

- ✅ HTTP URLs rejected with 400
- ✅ Malformed URLs rejected with 400
- ✅ HTTPS URLs accepted with 201

**Actual**: ******\_\_\_******

---

### ✅ AC6: Vault can verify tokens using shared library

**Test Steps**:

1. Create a test script using @polyphony/shared
2. Verify JWT from AC1

**Test Script** (`apps/registry/test-verify.ts`):

```typescript
import { verifyAuthToken } from "@polyphony/shared";

const token = process.argv[2];
const vaultId = process.argv[3];

try {
  const verified = await verifyAuthToken(token, {
    registryUrl: "http://localhost:8788",
    vaultId,
  });

  console.log("✅ Token verified successfully!");
  console.log("Email:", verified.email);
  console.log("Nonce:", verified.nonce);
  if (verified.name) console.log("Name:", verified.name);
  if (verified.picture) console.log("Picture:", verified.picture);
} catch (error) {
  console.error("❌ Verification failed:", error.message);
  process.exit(1);
}
```

**Commands**:

```bash
cd /home/michelek/Documents/github/polyphony/apps/registry

# Run verification test
npx tsx test-verify.ts "<jwt_from_ac1>" "<vault_id_from_ac1>"
```

**Expected**:

- ✅ Token verifies successfully
- ✅ Email matches Google account
- ✅ Nonce present
- ✅ Name and picture present (if provided by Google)

**Actual**: ******\_\_\_******

---

## Additional Integration Tests

### Test 7: Wrong Audience Rejection

**Commands**:

```bash
# Try to verify token with wrong vault_id
npx tsx test-verify.ts "<jwt_from_ac1>" "wrong-vault-id"
```

**Expected**:

- ✅ Verification fails with "unexpected 'aud' claim value"

**Actual**: ******\_\_\_******

---

### Test 8: Expired Token Rejection

**Commands**:

```bash
# Wait 6 minutes after AC1, then try to verify
sleep 360
npx tsx test-verify.ts "<jwt_from_ac1>" "<vault_id_from_ac1>"
```

**Expected**:

- ✅ Verification fails with "exp" or "expired" in error message

**Actual**: ******\_\_\_******

---

### Test 9: JWKS Caching

**Commands**:

```bash
# Verify token twice and check server logs for JWKS fetch
npx tsx test-verify.ts "<jwt1>" "<vault_id>"
npx tsx test-verify.ts "<jwt2>" "<vault_id>"

# Check Wrangler dev logs - should only see ONE JWKS fetch
```

**Expected**:

- ✅ Only one JWKS fetch in logs (second uses cache)

**Actual**: ******\_\_\_******

---

## Summary

**Phase 0 Acceptance Criteria**:

- [ ] AC1: OAuth login produces valid JWT
- [ ] AC2: JWT contains required claims
- [ ] AC3: JWKS endpoint exposes public key
- [ ] AC4: Token expires in 5 minutes
- [ ] AC5: Invalid callback URLs rejected
- [ ] AC6: Vault can verify tokens

**Additional Tests**:

- [ ] Test 7: Wrong audience rejection
- [ ] Test 8: Expired token rejection
- [ ] Test 9: JWKS caching

**Date Tested**: ******\_\_\_******  
**Tester**: ******\_\_\_******  
**Notes**: ******\_\_\_******
