# Polyphony

**A federated platform for choral music sharing.**

Polyphony empowers choirs to manage their sheet music privately while connecting with other choirs through a trusted network. No paywalls, no central control—your music library belongs to you.

---

## Production Status

**Vault:** [![Vault Deployment](https://img.shields.io/badge/vault-live-brightgreen?logo=cloudflare&logoColor=white&style=flat-square)](https://crede.polyphony.uk) `crede.polyphony.uk`  
**Registry:** [![Registry Deployment](https://img.shields.io/badge/registry-live-brightgreen?logo=cloudflare&logoColor=white&style=flat-square)](https://polyphony.uk) `polyphony.uk`

_First production deployment: Kammerkoor Crede (Feb 2026)_

---

## The Problem

Choirs today face a difficult choice:

- **Paid platforms** (IMSLP Pro, ChoralWiki premium) charge subscriptions and control your library
- **Informal sharing** (email, Dropbox) lacks organization and raises legal concerns
- **No good solution** for sharing rehearsal materials between choirs you trust

## The Solution

Polyphony is a **two-tier system**:

### 🏠 Your Vault

A private, self-hosted library for your choir.

- Upload and organize PDF scores
- Invite choir members with role-based access
- Your data stays under your control
- Connect with other choirs you trust

### 🌐 The Registry

A public hub that connects the ecosystem.

- Deploy your Vault with one click (no technical skills needed)
- Discover other choirs and their public offerings
- Browse Public Domain scores shared by the community
- Single sign-on across all Vaults

---

## How It Works

```text
┌──────────────────────────────────────────────────┐
│                   REGISTRY                       │
│      • Deploy Vaults  • Directory  • PD Catalog  │
└──────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ Vault A │◄─►│ Vault B │◄─►│ Vault C │
     │ Choir X │   │ Choir Y │   │ Choir Z │
     └─────────┘   └─────────┘   └─────────┘
          Direct P2P sharing between trusted choirs
```

1. **Create your Vault** via the Registry (takes 2 minutes)
2. **Upload scores** to your private library
3. **Invite members** by email—they log in via Registry
4. **Connect with other choirs** through a mutual "Handshake"
5. **Share scores** directly between trusted Vaults

---

## Features

### For Choir Directors

| Feature               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| **Private Library**   | Upload PDFs, organize by composer/season/voice part  |
| **Member Management** | Invite singers, assign roles (admin, singer)         |
| **Trusted Sharing**   | Connect with other choirs, share specific scores     |
| **Legal Safety**      | Built-in takedown process, Private Circle compliance |

### For Singers

| Feature         | Description                                         |
| --------------- | --------------------------------------------------- |
| **Easy Access** | Log in once, access any Vault you're a member of    |
| **View Scores** | Browser-based PDF viewer—no app required            |
| **Multi-Choir** | Sing in multiple choirs? One login works everywhere |

### For the Community

| Feature         | Description                                 |
| --------------- | ------------------------------------------- |
| **PD Catalog**  | Searchable index of Public Domain works     |
| **Open Source** | Inspect, modify, contribute to the codebase |
| **No Lock-in**  | Export your data anytime, host anywhere     |

---

## Getting Started

### For Choir Directors

1. Visit [scoreinstitute.eu](https://scoreinstitute.eu) _(coming soon)_
2. Click "Create Your Vault"
3. Follow the setup wizard
4. Start uploading scores!

### For Singers

1. Receive an invite from your choir director
2. Click the link to visit your choir's Vault
3. Log in with Google or email
4. Access your sheet music

### For Developers

See [Development](#development) section below.

---

## Legal Design

Polyphony is built with legal safety in mind:

- **Private Circle**: Sharing between trusted choirs follows EU "private use" guidelines
- **Vault Owner Responsibility**: Each choir controls and is responsible for their content
- **Registry Neutrality**: The Registry hosts no files—only links and metadata
- **Takedown Support**: Every Vault includes a copyright complaint mechanism

For full details, see [docs/LEGAL-FRAMEWORK.md](docs/LEGAL-FRAMEWORK.md).

> ⚠️ **Disclaimer**: This is not legal advice. Consult a lawyer for your jurisdiction.

---

## Technology

Built on a modern, proven stack:

| Component | Technology                 |
| --------- | -------------------------- |
| Framework | SvelteKit 2 + Svelte 5     |
| Platform  | Cloudflare Pages + Workers |
| Database  | Cloudflare D1 (SQLite)     |
| Storage   | D1 Chunked BLOBs (≤9.5MB)  |
| Styling   | Tailwind CSS v4            |
| Language  | TypeScript (strict)        |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

---

## Roadmap

### ✅ Phase 0: Foundation _(Complete)_

- [x] Registry OAuth + JWKS authentication
- [x] EdDSA JWT token signing/verification
- [x] Vault registration and callback flow

### ✅ Phase 0.5: Schema V2 _(Complete)_

- [x] Multi-organization support (umbrellas + collectives)
- [x] Affiliation tracking between organizations
- [x] Multi-role member system (owner, admin, librarian, conductor, section_leader)
- [x] Voices & sections with primary assignments
- [x] Score library (works → editions → files)
- [x] Physical copy inventory tracking
- [x] Event scheduling with participation/RSVP
- [x] Season and event repertoire management

### 🚧 Phase 1: Core Features _(In Progress)_

- [x] Member invitations with name-based matching
- [x] Score upload and management (D1 chunked storage)
- [x] Takedown mechanism
- [ ] Roster view with attendance tracking
- [ ] Season repertoire UI

### Phase 2: Federation _(Deferred)_

- [ ] Handshake protocol between Vaults
- [ ] P2P score sharing
- [ ] PD Catalog in Registry

### Phase 3: Enhanced Experience

- [ ] Public umbrella affiliates page
- [ ] Mobile-optimized UI
- [ ] Offline score access

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Cloudflare account (free tier works)

### Setup

```bash
# Clone the repository
git clone https://github.com/mitselek/polyphony.git
cd polyphony

# Install dependencies
pnpm install

# Start development server (Vault)
pnpm dev:vault

# Start development server (Registry)
pnpm dev:registry
```

### Project Structure

```
polyphony/
├── apps/
│   ├── registry/       # Registry application
│   └── vault/          # Vault application
├── packages/
│   └── shared/         # Shared types and utilities
└── docs/               # Documentation
```

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

---

## Documentation

| Document                                      | Description                    |
| --------------------------------------------- | ------------------------------ |
| [GLOSSARY.md](docs/GLOSSARY.md)               | Terminology definitions        |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)       | Technical architecture         |
| [DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) | D1 schema reference (Schema V2)|
| [LEGAL-FRAMEWORK.md](docs/LEGAL-FRAMEWORK.md) | Legal design and compliance    |
| [CONCERNS.md](docs/CONCERNS.md)               | Open questions and decisions   |

---

## Contributing

We welcome contributions! Please read our contributing guidelines _(coming soon)_.

### Ways to Help

- Report bugs
- Suggest features
- Improve documentation
- Help curate the PD Catalog
- Submit pull requests

---

## License

[MIT](LICENSE)

Copyright (c) 2026 Institute of Beautiful Scores

---

## Acknowledgments

- Operated by [Institute of Beautiful Scores](https://scoreinstitute.eu)
- Inspired by the needs of Estonian choral communities
- Built with [SvelteKit](https://kit.svelte.dev/) and [Cloudflare](https://cloudflare.com/)
- Name "Polyphony" reflects multiple independent voices harmonizing together

---

_Polyphony: Many voices, one harmony._
