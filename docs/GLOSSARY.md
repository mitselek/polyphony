# Polyphony Glossary

Canonical terminology for the Polyphony ecosystem. Use these terms consistently across all documentation.

---

## Core Components

### Vault

A self-contained, independently hosted instance serving a single choir.

- **Owner**: The person who deployed the Vault (typically choir director or admin)
- **Members**: Choir singers with access to the Vault
- **Hosted on**: Cloudflare (via Registry deploy) or self-hosted

**Current Features**:

- Score library (upload, organize, view)
- Member access control
- Roster management
- Event scheduling and attendance

**Future Features**:

- Press releases / public page
- Federation (Handshake) - deferred

### Registry

The central coordination service for the Polyphony ecosystem.

**Responsibilities**:

1. **Auth Gateway**: Stateless authentication for all Vaults (OAuth, magic link)
2. **Deployment**: One-click Vault creation on Cloudflare
3. **Discovery**: Directory of registered Vaults (opt-in listing)
4. **Introduction**: Facilitates Handshake between Vaults (then steps out)
5. **PD Catalog**: Searchable index of Public Domain scores (links to Vaults, not hosted)

**Does NOT**:

- Host score files (only links)
- Route federated traffic (Vaults communicate P2P)
- Store user data (stateless auth - no user database)

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

### Vault Owner

The person who deployed/registered the Vault. Has full administrative rights:

- Manage members
- Approve Handshakes
- Configure sharing permissions
- Mark scores as PD/CC for Registry listing

### Vault Member

A choir singer with access to a specific Vault:

- View/download scores (based on permissions)
- Access shared content from trusted Vaults (if enabled)

### Registry User

Anyone using the public Registry interface:

- Browse PD Catalog
- Search Vault Directory
- Deploy new Vault (creates Vault Owner role)

---

## Technical Terms

### JWT (JSON Web Token)

Cryptographic token used for authentication between Vaults and Registry.

### mTLS (Mutual TLS)

Two-way certificate authentication. Potential mechanism for Vault-to-Vault trust.

### Cloudflare Workers

Serverless compute platform. Primary deployment target for Vaults.

### D1

Cloudflare's serverless SQL database. Used for Vault data and file storage.

Score files are stored in D1 using chunked storage (files >2MB are split into ~1.9MB chunks). Maximum file size: 9.5MB.

### R2

Cloudflare's object storage. **Not currently used** - files are stored in D1 for simplicity. May be used in future for larger file support.

---

## Deprecated Terms

| Don't use    | Use instead |
| ------------ | ----------- |
| Node         | Vault       |
| Hub          | Registry    |
| Central Hub  | Registry    |
| Private Node | Vault       |

---

_Last updated: 2026-01-25_
