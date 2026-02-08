# Polyphony: Open Questions & Concerns

This document tracks unresolved questions that need answers before implementation.

> **Terminology**: See [GLOSSARY.md](GLOSSARY.md) for canonical definitions.

---

## 1. Legal Framework

### Private Circle Exemption

- [ ] Does P2P sharing between trusted Vaults qualify as "private" under EU copyright law?
- [ ] How does the exemption vary across EU member states?
- [ ] What documentation/audit trail is needed to prove "private circle" status?
- [ ] At what scale does a "private circle" become "public"? (10 choirs? 100?)

### Liability & Compliance

- [ ] Who is legally responsible when a Vault hosts infringing content?
- [ ] Is the software author ever liable, or only the Vault operator?
- [ ] What constitutes adequate "Notice and Action" under EU DSA?
- [ ] Do we need a formal legal entity (non-profit?) for the Registry?
- [ ] DMCA considerations for non-EU users?
- [x] Does Registry host PD content directly? → **No, links only.** Reduces liability.

### Content Verification

- [ ] How do we verify Public Domain status? (Composer death date + 70 years varies by country)
- [ ] Who bears the burden of proof for PD/CC claims? (Vault owner who marks it PD?)
- [ ] What happens if a "verified" PD work turns out to have copyright issues?
- [ ] Can Registry delist a Vault's PD contribution if challenged?

---

## 2. Federation Protocol

> ⏳ **DEFERRED**: Federation is planned for a future phase. Current focus is on single-vault functionality.

### Trust Establishment

- [ ] Wire protocol specification: REST? GraphQL? Custom binary?
- [ ] Authentication mechanism: mTLS, signed JWTs, or both?
- [x] How do Vaults discover each other? → **Registry provides discovery service.**
- [x] Does Registry route federated traffic? → **No, introduces only. Vaults talk P2P.**
- [ ] Can trust be revoked? What happens to in-flight sessions?
- [ ] Is trust transitive? (If A trusts B and B trusts C, does A trust C?)

### Data Exchange

- [ ] Are scores streamed on-demand or cached locally?
- [ ] What metadata is visible before establishing trust?
- [ ] How do we handle version conflicts for shared transcriptions?
- [ ] Bandwidth considerations for large PDF/MusicXML files?

### Security

- [ ] How do we prevent a malicious Vault from scraping a trusted peer?
- [ ] Rate limiting between federated Vaults?
- [ ] Audit logging for federated access?

---

## 3. Identity & Access

### Authentication

- [x] ~~Is there a master identity provider, or per-Vault authentication?~~ **RESOLVED**: Single Vault deployment. Registry handles OAuth + magic link. SSO cookie on `.polyphony.uk` domain.
- [ ] How does cross-organization authentication work? (Currently: same identity across all orgs via Registry SSO)
- [ ] How do individual singers authenticate across organizations?
- [x] ~~Social login support? (Google, Microsoft, etc.)~~ **IMPLEMENTED**: Google OAuth via Registry.

### Authorization

- [ ] Permission granularity: View-only vs Download vs Share-with-peers?
- [ ] Can a Vault admin restrict which scores are visible to which trusted peers?
- [ ] How do "guest" users work? (Preview before joining a choir)

### Invitation Workflow

- [ ] How does a singer join a Vault? (Email invite? QR code? Magic link?)
- [ ] Approval workflow for new member requests?
- [ ] Bulk import from existing member lists?

---

## 4. Technical Implementation

### Deployment

- [x] Primary deployment target? → **Cloudflare (via Registry one-click deploy).**
- [x] Self-hosting supported? → **Yes, Vaults can be deployed anywhere and manually registered.**
- [x] What Cloudflare services required? → **Pages + D1 (no R2 - files stored in D1 with chunked storage).**
- [ ] Minimum Cloudflare plan tier? (Free tier sufficient?)
- [ ] Self-hosted: Docker Compose? Minimum server specs?

### Maintenance & Updates

- [ ] Who pushes security updates to distributed Vault instances?
- [ ] Auto-update mechanism? (Risks vs. benefits)
- [ ] Breaking changes in federation protocol - how to handle version skew?
- [ ] How does Registry-deployed Vault get updated vs. self-hosted?

### Data Management

- [ ] Backup/restore workflow for Vault data?
- [ ] Data export format for portability?
- [ ] What happens when a Vault shuts down? (Graceful exit from federation)

### Mobile & Offline

- [ ] Mobile-responsive web UI, or native apps?
- [ ] Offline access to scores during rehearsal?
- [ ] Sync mechanism for offline changes?

---

## 5. User Experience

### Onboarding

- [ ] How do we explain federation to non-technical users?
- [x] Setup wizard for first-time Vault installation? → **Registry handles deployment.**
- [ ] Sample content to demo the system?
- [ ] What does the Registry deployment flow look like? (Cloudflare account creation?)

### Daily Use

- [ ] Search within own library vs. federated search?
- [ ] How do users find scores they don't know exist?
- [ ] Notification system for new shared content?

### Edge Cases

- [ ] What if two Vaults have the same score? Deduplication?
- [ ] Copyright dispute between Vaults - how to resolve?
- [ ] Vault admin leaves the choir - ownership transfer?

---

## 6. Business & Sustainability

### Funding

- [ ] Who pays for Central Registry hosting?
- [ ] Donation model? Grants? Choir association sponsorship?
- [ ] Freemium tier for managed Vault hosting?

### Governance

- [ ] Who decides what gets listed in the PD catalog? (Vault owner claims, Registry verifies?)
- [ ] Moderation policy for the Vault Directory?
- [ ] Community contribution model for software development?

### Long-term Viability

- [ ] Exit strategy if project funding ends?
- [ ] Data migration path if ecosystem shuts down?
- [ ] Open-source license choice? (AGPL to prevent proprietary forks?)

---

## 7. Scaling Considerations

- [ ] What if 1000+ organizations register? Discovery/directory performance?
- [ ] Registry API performance when querying Vault public endpoints at scale?
- [ ] CDN/caching strategy for popular PD scores? (Files currently in D1, future: R2 + CDN)

---

## Priority Matrix

| Question                      | Impact   | Urgency       | Owner         |
| ----------------------------- | -------- | ------------- | ------------- |
| Private Circle legal validity | Critical | Before MVP    | Legal counsel |
| Federation wire protocol      | Low      | Deferred      | Tech lead     |
| Deployment complexity         | High     | Phase 1       | UX + DevOps   |
| Identity/auth model           | High     | Phase 1       | Tech lead     |
| Funding model                 | Medium   | Before launch | Project lead  |

---

_Last updated: 2026-01-23_
