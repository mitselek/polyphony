# Polyphony Glossary

Canonical terminology for the Polyphony ecosystem. Use these terms consistently across all documentation.

---

## Core Components

### Vault

The single **app deployment** hosting all organizations. Think of it like Gmail - one deployment, millions of independent accounts.

- **Single Deployment**: One app instance (infrastructure)
- **Subdomain Routing**: `crede.polyphony.uk`, `kamari.polyphony.uk` etc. route to the same app
- **Organization Context**: Determined from subdomain in URL

**What's shared** (infrastructure):
- The application code
- The D1 database instance
- Authentication via Registry

**What's independent** (per organization):
- Score library - each choir has its own
- Roster/members - separate per org
- Events & schedules - separate per org
- Participation records - separate per org

### Organization

A choir (collective) or umbrella entity. Each organization has **completely independent data**:

- Its own score library (works, editions, files)
- Its own member roster
- Its own event schedule
- Its own participation/attendance records

Organizations are isolated - Choir A cannot see Choir B's scores or members (unless future federation features enable explicit sharing).

### Registry

Zero-storage auth gateway and discovery layer.

**Responsibilities**:

1. **Auth Gateway**: OAuth, magic link, SSO cookie on `.polyphony.uk`
2. **Discovery**: Queries Vault public APIs for org directory
3. **PD Catalog**: Queries Vault public APIs for Public Domain scores
4. **Messaging**: Email notifications via Resend
5. **Registration UI**: Serves form, calls Vault API to create org

**Stores ONLY**:

- `signing_keys`: JWT signing keys
- `email_auth_codes`: Magic link codes
- `email_rate_limits`: Rate limiting

**Does NOT Store**:

- Organizations or user data
- Scores or files
- Anything queryable from Vault

---

## Federation Concepts

> ⏳ **DEFERRED**: Federation and Handshake features are planned for a future phase. Current focus is on single-vault functionality and umbrella organization support.

### Handshake (Future)

The process by which two Vaults would establish mutual trust for score sharing.

**Conceptual Flow**:

1. Vault A finds Vault B via Registry directory (or direct URI exchange)
2. Vault A sends trust request to Vault B
3. Vault B admin approves
4. Cryptographic trust established (mechanism TBD: mTLS / signed JWTs)
5. Vaults can share scores directly (P2P)

**Properties** (when implemented):

- Requires explicit approval from both parties
- Can be revoked at any time
- Not transitive (A trusts B, B trusts C ≠ A trusts C)

### Federation (Future)

The network of Vaults connected via Handshakes. Each Vault chooses its trusted peers independently.

### P2P (Peer-to-Peer) (Future)

Direct communication between Vaults without routing through Registry. After Handshake, all score sharing would happen P2P.

---

## Content Classification

### Public Domain (PD)

Works where copyright has expired (typically 70+ years after composer's death, varies by country).

- Can be listed in Registry's PD Catalog
- Vault owner responsible for verifying PD status

### Creative Commons (CC)

Works released under CC licenses by the rights holder.

- Treated similarly to PD for sharing purposes
- License terms must be respected

### Private Transcription

User-created transcriptions of copyrighted works.

- **Never** listed in Registry
- Can only be shared via Handshake (Private Circle)
- Legal basis: EU private copying exemption (requires validation)

### Original Work

Works where the Vault owner holds full copyright.

- Can be shared freely or restricted at owner's discretion

---

## User Roles

### Organization Owner

The person who registered the organization. Has full administrative rights:

- Manage members and roles
- Configure organization settings
- Mark scores as PD/CC for public listing

### Organization Member

A choir singer with access to a specific organization:

- View/download scores (based on permissions)
- RSVP to events
- Access shared content within the organization

### Registry User

Anyone using the public Registry interface:

- Browse PD Catalog (queried from Vault)
- Search Organization Directory (queried from Vault)
- Register new organization (via Vault API)

---

## Technical Terms

### JWT (JSON Web Token)

Cryptographic token used for authentication between Vaults and Registry.

### mTLS (Mutual TLS)

Two-way certificate authentication. Potential mechanism for Vault-to-Vault trust.

### Cloudflare Workers

Serverless compute platform. Deployment target for both Registry and Vault.

### D1

Cloudflare's serverless SQL database.

- **Vault D1**: All org/member/score data (single database for all orgs)
- **Registry D1**: Auth-only data (signing keys, email codes)

Score files are stored in D1 using chunked storage (files >2MB are split into ~1.9MB chunks). Maximum file size: 9.5MB.

### R2

Cloudflare's object storage. **Not currently used** - files are stored in D1 for simplicity. May be used in future for larger file support.

---

## Deprecated Terms

| Don't use                | Use instead            | Why                                              |
| ------------------------ | ---------------------- | ------------------------------------------------ |
| Node                     | Vault                  | Clarity                                          |
| Hub                      | Registry               | Clarity                                          |
| Central Hub              | Registry               | Clarity                                          |
| Private Node             | Vault                  | Clarity                                          |
| Per-choir deployment     | Single Vault deployment| One app hosts all orgs (but data is separate)    |
| Vault owner (deployment) | Organization owner     | "Vault" is infrastructure, not a choir           |

---

_Last updated: 2026-02-08_
