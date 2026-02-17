# Polyphony Development Roadmap

Strategic roadmap for evolving Polyphony from single-vault to multi-tenant umbrella architecture.

**Status**: Active  
**Last Updated**: 2026-02-05

---

## Architecture Decision (2026-02-01)

**Key insight**: Registry stays stateless. All organization data lives in Vault.

```
┌────────────────────────────────────────────────────────────┐
│ Registry (polyphony.uk)                                    │
│ ├── D1: vaults, signing_keys (existing)                    │
│ ├── Stateless auth (OAuth, magic link, SSO cookie)         │
│ └── No user/org storage                                    │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Vault (vault.polyphony.uk) - SINGLE DEPLOYMENT             │
│ ├── D1: organizations, members, member_organizations, ...  │
│ ├── All orgs in one database                               │
│ └── Subdomains route to same app (org context from URL)    │
└────────────────────────────────────────────────────────────┘
```

See [SCHEMA-V2-EVOLUTION.md](SCHEMA-V2-EVOLUTION.md) for complete schema design.

---

## Current State

- ✅ Single vault codebase (Kammerkoor Crede)
- ✅ Registry handles OAuth + email magic link authentication
- ✅ Vault features: members, events, scores, editions, seasons, attendance
- ✅ **Schema V2 design complete** (see SCHEMA-V2-EVOLUTION.md)
- ✅ **Schema V2 migrations applied to production** (2026-02-01)
- ✅ **Subdomain routing implemented** (crede.polyphony.uk live)
- ✅ **i18n Epic complete** - Paraglide JS + 4 locales (en, et, lv, uk)
- 🔲 No umbrella organization support (UI pending)
- 🔲 No billing/subscriptions

---

## Phase 0: Schema V2 Design ✅ COMPLETE

**Goal**: Design multi-organization schema supporting umbrellas and collectives.

**Completed 2026-02-01**. See [SCHEMA-V2-EVOLUTION.md](SCHEMA-V2-EVOLUTION.md) for full design.

**Key decisions:**

- ✅ Registry stays stateless (no organization tables)
- ✅ All org data in Vault D1 (single deployment)
- ✅ Global identity pool with org-scoped memberships
- ✅ Voices global, sections per-org
- ✅ Affiliations with history tracking
- ✅ Invite acceptance flow with merge logic

---

## Phase 0.5: Schema V2 Implementation ✅ COMPLETE

**Goal**: Create and apply migrations to implement V2 schema.

**Completed 2026-02-01**. All migrations applied to production, Crede live at `crede.polyphony.uk`.

### 0.5.1 Vault Migrations ✅

Migration files for V2 schema:

- [x] `0025_organizations.sql` - organizations table
- [x] `0026_drop_event_programs.sql` - drop legacy event_programs table
- [x] `0027_member_organizations.sql` - junction table, migrate existing members
- [x] `0028_member_roles_org_id.sql` - add org_id to member_roles
- [x] `0029_sections_org_id.sql` - add org_id to sections
- [x] `0030_content_org_id.sql` - add org_id to events, works, seasons, invites
- [x] `0031_affiliations.sql` - affiliations table with history

### 0.5.2 Data Migration ✅

Migrated existing Crede data to V2 structure:

- [x] Created organization record for Kammerkoor Crede (subdomain: `crede`)
- [x] Populated member_organizations from existing members
- [x] Copied member_roles with org_id
- [x] Updated sections with org_id
- [x] Updated content tables with org_id

**Note**: member_sections assignments were lost during migration cleanup; manually reassigned.

### 0.5.3 Subdomain Routing ✅

- [x] Extract subdomain from request URL in hooks
- [x] Lookup organization by subdomain
- [x] Add org context to `locals`
- [x] Cloudflare Pages custom domain: `crede.polyphony.uk`
- [x] Registry callback URL updated for subdomain

### 0.5.4 Code Updates ✅

- [x] Updated hooks.server.ts with subdomain extraction
- [x] Added organization context to session (via locals.org)
- [x] Consolidated Member interface definitions (#170)

**Deliverables** ✅:

- [x] All migration files created and tested
- [x] Existing data migrated
- [x] Subdomain routing working
- [x] All tests passing with new schema
- [x] **Crede fully functional on V2 schema at crede.polyphony.uk**

---

## Phase 0.6: Internationalization (i18n) ✅ COMPLETE

**Goal**: Multi-language support with user/org preferences.

**Completed 2026-02-05**. See Epic #183.

### 0.6.1 i18n Framework ✅

- [x] Chose Paraglide JS (compile-time, type-safe)
- [x] Integrated with SvelteKit
- [x] 4 locales: English (en), Estonian (et), Latvian (lv), Ukrainian (uk)

### 0.6.2 Database Schema ✅

- [x] Added language/locale/timezone to organizations table
- [x] Created member_preferences table
- [x] Cascading resolution: member → org → defaults

### 0.6.3 Settings UI ✅

- [x] Organization settings page (admin-only)
- [x] Member profile preferences page
- [x] "Use organization default" option

### 0.6.4 String Extraction ✅

- [x] Navigation strings
- [x] Login/welcome/invite pages
- [x] Landing page
- [x] Copyright/takedown pages

### 0.6.5 Testing ✅

- [x] Message consistency tests (key presence, snake_case naming)
- [x] Placeholder validation
- [x] All 940+ tests passing

**Deliverables** ✅:

- [x] Paraglide JS integrated
- [x] 4 locales with translations
- [x] User/org preference UI
- [x] i18n test coverage

---

## Phase 1: SSO Cookie (Multi-Org Convenience)

**Goal**: Enable seamless login across multiple organizations.

**Status**: Next up. Not blocking for single-org usage. Crede works now.

### 1.1 SSO Cookie Implementation

Stateless cross-subdomain auth via signed JWT cookie on `.polyphony.uk`.

See [SCHEMA-V2-EVOLUTION.md#sso-flow](SCHEMA-V2-EVOLUTION.md#sso-flow) for design.

**Tasks:**

- [ ] Add SSO cookie signing/verification to Registry auth endpoints
- [ ] Update `/auth` to check SSO cookie before showing login
- [ ] Update `/auth/callback` to set SSO cookie after successful login
- [ ] Add `/auth/logout` endpoint to clear SSO cookie

### 1.2 Wildcard DNS

- [x] Configure `*.polyphony.uk` CNAME to vault deployment (done, but Pages requires per-subdomain custom domain)
- [ ] Verify SSL certificate covers wildcard

**Deliverables**:

- [ ] SSO cookie working across subdomains
- [ ] Wildcard DNS configured

---

## Phase 2: Organization Registration

**Goal**: Allow umbrellas and collectives to register (handled in Vault, not Registry).

### 2.1 Registration UI

- [ ] `/register` page with organization type selection
- [ ] Umbrella registration form (name, contact email, subdomain)
- [ ] Collective registration form (name, contact email, subdomain, optional umbrella)
- [ ] Subdomain availability checker (real-time)
- [ ] Create organization + first owner member on submit

### 2.2 Affiliation Workflow

- [ ] Affiliation request creation (collective → umbrella)
- [ ] Umbrella notification (email)
- [ ] Umbrella approval/rejection UI
- [ ] Collective notification on approval
- [ ] Affiliation history tracking (left_at)

### 2.3 Organization Dashboard (Basic)

- [ ] Org settings page (name, contact, subdomain)
- [ ] List affiliated collectives (for umbrellas)
- [ ] View affiliation status (for collectives)

**Deliverables**:

- [ ] Registration pages (in Vault)
- [ ] Affiliation API endpoints
- [ ] Basic dashboard

---

## Phase 3: DNS & Subdomain Automation

**Goal**: Automate subdomain provisioning for new organizations.

With single-vault architecture, we don't need separate deployments. Just DNS records.

### 3.1 Cloudflare DNS API

- [ ] Store Cloudflare credentials securely (secrets)
- [ ] Add CNAME record for new subdomain via API
- [ ] Validate subdomain format and availability

### 3.2 Organization Activation Flow

1. Admin creates org → subdomain reserved in DB
2. Background job creates DNS CNAME
3. Org marked active when DNS propagates
4. Welcome email with login link

### 3.3 Subdomain Management

- [ ] Change subdomain (update DNS + DB)
- [ ] Delete organization (remove DNS record)
- [ ] Handle DNS propagation delays gracefully

**Deliverables**:

- [ ] DNS automation service
- [ ] Org activation flow
- [ ] Admin tools for subdomain management

---

## Phase 4: Umbrella Dashboard

**Goal**: Full umbrella management capabilities.

### 4.1 Affiliate Management

- [ ] List all affiliates with status
- [ ] Pending requests view
- [ ] Remove affiliate (with confirmation)
- [ ] Invite collective (pre-approved registration link)

### 4.2 Aggregated Statistics

- [ ] Total member count across affiliates
- [ ] Storage usage summary
- [ ] Event calendar (public events from affiliates)
- [ ] Active/inactive vault counts

### 4.3 Joint Events & Scores

- [ ] Create umbrella-level event
- [ ] Upload scores/editions to umbrella library
- [ ] Attach editions to events
- [ ] Select target affiliates (all or specific)
- [ ] Event/score visibility in affiliate vaults

### 4.4 Shared Content

- [ ] Umbrella can share events/scores with affiliates
- [ ] Affiliate vault shows "Shared by [Umbrella]" section
- [ ] Affiliate members can view shared content

**Deliverables**:

- [ ] Umbrella dashboard pages
- [ ] Shared content UI

---

## Phase 5: Billing Integration

**Goal**: Stripe-based subscription management.

### 5.1 Stripe Setup

- [ ] Stripe account configuration
- [ ] Product/price creation (umbrella plans, independent tiers)
- [ ] Webhook endpoint for subscription events

### 5.2 Subscription Management

- [ ] Payment method collection (Stripe Elements)
- [ ] Subscription creation on registration
- [ ] 30-day trial implementation
- [ ] Upgrade/downgrade flows

### 5.3 Usage-Based Billing

- [ ] Vault → Registry usage reporting (daily cron)
- [ ] Storage calculation and aggregation
- [ ] Umbrella invoice with affiliate breakdown
- [ ] Multi-umbrella cost splitting

### 5.4 Grace Period & Enforcement

- [ ] 30-day grace period on umbrella departure
- [ ] Read-only mode for unpaid orgs
- [ ] Reactivation flow

**Deliverables**:

- [ ] Stripe integration
- [ ] Billing dashboard
- [ ] Usage reporting system

---

## Phase 6: Production Hardening

**Goal**: Production-ready multi-tenant system.

### 6.1 Security Audit

- [ ] API authentication review
- [ ] Cross-vault data isolation verification
- [ ] Rate limiting
- [ ] Audit logging

### 6.2 Monitoring & Observability

- [ ] Error tracking (Sentry or similar)
- [ ] Usage metrics dashboard
- [ ] Health checks for all vaults
- [ ] Alerting for failed provisioning

### 6.3 Documentation

- [ ] User guide for umbrella admins
- [ ] User guide for collective admins
- [ ] API documentation
- [ ] Self-hosting guide

### 6.4 Migration Path

- [ ] Migrate existing Crede vault to V2 schema
- [ ] Backfill usage data
- [ ] Grandfather existing users (if applicable)

**Deliverables**:

- [ ] Security audit report
- [ ] Monitoring setup
- [ ] Complete documentation

---

## Future Phases (Backlog)

### R2 Storage Migration

Migrate score files from D1 chunked storage to R2 object storage.

**Prerequisites**: Workers Paid plan ($5/mo) from paying customers.

**Benefits**:

- 50x cheaper storage ($0.015/GB vs $0.75/GB)
- Remove chunking complexity
- Support files >9.5MB
- No egress fees for downloads

**Tasks**:

- [ ] Create R2 bucket for score files
- [ ] Migration script: D1 chunks → R2 objects
- [ ] Update edition-storage.ts to use R2
- [ ] Update download endpoints
- [ ] Remove chunking code

### Cloudflare Pro Plan Migration

Upgrade from Free to Pro plan when approaching DNS record limits.

**Current Limits (Free Plan)**:

- 200 DNS records (zones created after Sept 2024)
- ~100 vaults max (each vault needs ~2 records: CNAME + TXT)

**Pro Plan ($25/mo)**:

- 3,500 DNS records
- ~1,750 vaults capacity

**Trigger**: When approaching 80 vaults, plan upgrade.

**Tasks**:

- [ ] Monitor DNS record count via Cloudflare API
- [ ] Add alerting at 80% capacity (160 records)
- [ ] Upgrade to Pro when needed
- [ ] Update provisioning docs

### Federation (Deferred)

- Vault-to-vault direct sharing
- Handshake trust establishment
- P2P score sharing

### Mobile App

- Native iOS/Android apps
- Offline score viewing
- Push notifications for events

### Advanced Features

- Rehearsal scheduling with member availability
- Part assignment and tracking
- Audio/video attachments for learning
- Integration with music notation software

---

## Priority Matrix

| Phase                        | Effort | Value    | Priority |
| ---------------------------- | ------ | -------- | -------- |
| 0: Schema V2 Design          | Medium | Critical | ✅ Done  |
| 0.5: Schema V2 + Routing     | Medium | Critical | ✅ Done  |
| 0.6: Internationalization    | Medium | High     | ✅ Done  |
| 1: SSO Cookie                | Low    | Medium   | **P2**   |
| 2: Organization Registration | Medium | High     | **P1**   |
| 3: DNS Automation            | Low    | Medium   | **P1**   |
| 4: Umbrella Dashboard        | High   | High     | **P2**   |
| 5: Billing Integration       | High   | Medium   | **P2**   |
| 6: Production Hardening      | Medium | High     | **P3**   |

---

## Current Sprint

**Focus**: Phase 2 - Organization Registration

**Goal**: Allow new choirs to register and get their own subdomain.

- [ ] `/register` page with organization type selection
- [ ] Registration form (name, contact email, subdomain)
- [ ] Subdomain availability checker (real-time)
- [ ] Create organization + first owner member on submit
- [ ] Update Cloudflare DNS via API (manual for now, automate in Phase 3)

---

## Related Documents

- [SCHEMA-V2-EVOLUTION.md](SCHEMA-V2-EVOLUTION.md) - V2 schema design (complete)
- [STORAGE-ASSESSMENT.md](STORAGE-ASSESSMENT.md) - D1 vs R2 storage analysis
- [UMBRELLA-ORGANIZATIONS.md](UMBRELLA-ORGANIZATIONS.md) - Business model specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) - Current V1 vault schema
- [CONCERNS.md](CONCERNS.md) - Open questions and risks

---

_Last updated: 2026-02-05_
