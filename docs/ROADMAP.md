# Polyphony Development Roadmap

Strategic roadmap for evolving Polyphony from single-vault to multi-tenant umbrella architecture.

**Status**: Active  
**Last Updated**: 2026-02-01

---

## Current State

- ✅ Single vault codebase deployed to multiple subdomains manually
- ✅ Registry handles OAuth + email magic link authentication
- ✅ Vault features: members, events, scores, editions, seasons, attendance
- ✅ Manual subdomain provisioning via Cloudflare API
- ❌ No umbrella organization support
- ❌ No billing/subscriptions
- ❌ No multi-vault awareness in Registry

---

## Phase 0: Schema Redesign & Multi-Tenant Foundation

**Goal**: Restructure database schemas to support multiple vaults and umbrellas from the start.

### 0.1 Registry Schema Migration

Add organization and subscription support to Registry database.

**New tables**:

```sql
-- Organization types: 'umbrella' or 'collective'
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('umbrella', 'collective')),
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many affiliations (collectives can have multiple umbrellas)
CREATE TABLE affiliations (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(collective_id, umbrella_id)
);

-- Subscription/billing state
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id),
    plan TEXT NOT NULL CHECK (plan IN ('free', 'tier1', 'tier2', 'umbrella', 'trial')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trial', 'grace')),
    trial_ends_at TEXT,
    grace_ends_at TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Affiliation requests
CREATE TABLE affiliation_requests (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    responded_by TEXT,
    responded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usage reports from vaults
CREATE TABLE usage_reports (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    report_date TEXT NOT NULL,
    member_count INTEGER NOT NULL,
    score_count INTEGER NOT NULL,
    storage_bytes INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(vault_id, report_date)
);

-- Umbrella-level events (shared with affiliates)
CREATE TABLE umbrella_events (
    id TEXT PRIMARY KEY,
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    location TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which affiliates see which umbrella events
CREATE TABLE umbrella_event_targets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES umbrella_events(id) ON DELETE CASCADE,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    UNIQUE(event_id, collective_id)
);

-- Umbrella-level scores (shared library)
CREATE TABLE umbrella_editions (
    id TEXT PRIMARY KEY,
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    work_title TEXT NOT NULL,
    composer TEXT,
    edition_name TEXT NOT NULL,
    file_data BLOB,
    file_name TEXT,
    file_size INTEGER,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Event-edition linkage for umbrella events
CREATE TABLE umbrella_event_editions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES umbrella_events(id) ON DELETE CASCADE,
    edition_id TEXT NOT NULL REFERENCES umbrella_editions(id),
    display_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(event_id, edition_id)
);
```

**Modified tables**:

```sql
-- Add org reference to vaults
ALTER TABLE vaults ADD COLUMN org_id TEXT REFERENCES organizations(id);
```

### 0.2 Vault Schema Review

Review vault schema for multi-tenant compatibility:

- [ ] Ensure no hardcoded assumptions about single vault
- [ ] Add `vault_id` context to session/auth if needed
- [ ] Review member email uniqueness (per-vault, not global)
- [ ] Consider: should invites reference Registry organizations?

### 0.3 Configuration Refactor

- [ ] Move `VAULT_ID` from hardcoded config to environment variable
- [ ] Add `REGISTRY_URL` validation on startup
- [ ] Create vault self-registration flow with Registry

**Deliverables**:

- [ ] Registry migration files (0002_organizations.sql, etc.)
- [ ] Vault config refactor
- [ ] Documentation updates

---

## Phase 1: Organization Registration

**Goal**: Allow umbrellas and collectives to register via Registry.

### 1.1 Organization Registration UI

- [ ] `/register` page with organization type selection
- [ ] Umbrella registration form (name, contact email, slug)
- [ ] Collective registration form (name, contact email, slug, optional umbrella)
- [ ] Subdomain availability checker (real-time)

### 1.2 Affiliation Workflow

- [ ] Affiliation request creation
- [ ] Umbrella notification (email)
- [ ] Umbrella approval/rejection UI
- [ ] Collective notification on approval

### 1.3 Organization Dashboard (Basic)

- [ ] `/dashboard/org/{slug}` - view organization details
- [ ] List affiliated vaults (for umbrellas)
- [ ] View affiliation status (for collectives)

**Deliverables**:

- [ ] Registration pages
- [ ] Affiliation API endpoints
- [ ] Basic dashboard

---

## Phase 2: Automated Vault Provisioning

**Goal**: One-click vault creation when organization is approved.

### 2.1 Cloudflare API Integration

- [ ] Store Cloudflare credentials securely (secrets)
- [ ] Create Pages project via API
- [ ] Add custom domain via API
- [ ] Create D1 database via API (if possible) or document manual step

### 2.2 Vault Initialization

- [ ] Deploy vault code to new Pages project
- [ ] Run initial migrations
- [ ] Create owner member from registration email
- [ ] Send welcome email with login link

### 2.3 Provisioning Queue

- [ ] Background job for provisioning (avoid timeout)
- [ ] Status tracking (pending → provisioning → active → failed)
- [ ] Retry logic for transient failures

**Deliverables**:

- [ ] Provisioning service
- [ ] Status API
- [ ] Admin provisioning dashboard

---

## Phase 3: Umbrella Dashboard

**Goal**: Full umbrella management capabilities.

### 3.1 Affiliate Management

- [ ] List all affiliates with status
- [ ] Pending requests view
- [ ] Remove affiliate (with confirmation)
- [ ] Invite collective (pre-approved registration link)

### 3.2 Aggregated Statistics

- [ ] Total member count across affiliates
- [ ] Storage usage summary
- [ ] Event calendar (public events from affiliates)
- [ ] Active/inactive vault counts

### 3.3 Joint Events & Scores

- [ ] Create umbrella-level event
- [ ] Upload scores/editions to umbrella library
- [ ] Attach editions to events
- [ ] Select target affiliates (all or specific)
- [ ] Event/score visibility in affiliate vaults

### 3.4 Vault API for Shared Content

- [ ] `GET /api/umbrella/events` - fetch events shared with this vault
- [ ] `GET /api/umbrella/editions/{id}` - fetch shared edition file
- [ ] Vault UI: "Shared by [Umbrella Name]" section

**Deliverables**:

- [ ] Umbrella dashboard pages
- [ ] Shared content API
- [ ] Vault shared content UI

---

## Phase 4: Billing Integration

**Goal**: Stripe-based subscription management.

### 4.1 Stripe Setup

- [ ] Stripe account configuration
- [ ] Product/price creation (umbrella plans, independent tiers)
- [ ] Webhook endpoint for subscription events

### 4.2 Subscription Management

- [ ] Payment method collection (Stripe Elements)
- [ ] Subscription creation on registration
- [ ] 30-day trial implementation
- [ ] Upgrade/downgrade flows

### 4.3 Usage-Based Billing

- [ ] Vault → Registry usage reporting (daily cron)
- [ ] Storage calculation and aggregation
- [ ] Umbrella invoice with affiliate breakdown
- [ ] Multi-umbrella cost splitting

### 4.4 Grace Period & Enforcement

- [ ] 30-day grace period on umbrella departure
- [ ] Read-only mode for unpaid vaults
- [ ] Reactivation flow

**Deliverables**:

- [ ] Stripe integration
- [ ] Billing dashboard
- [ ] Usage reporting system

---

## Phase 5: Production Hardening

**Goal**: Production-ready multi-tenant system.

### 5.1 Security Audit

- [ ] API authentication review
- [ ] Cross-vault data isolation verification
- [ ] Rate limiting
- [ ] Audit logging

### 5.2 Monitoring & Observability

- [ ] Error tracking (Sentry or similar)
- [ ] Usage metrics dashboard
- [ ] Health checks for all vaults
- [ ] Alerting for failed provisioning

### 5.3 Documentation

- [ ] User guide for umbrella admins
- [ ] User guide for collective admins
- [ ] API documentation
- [ ] Self-hosting guide

### 5.4 Migration Path

- [ ] Migrate existing vaults to organization model
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
| 0: Schema Redesign           | Medium | Critical | **P0**   |
| 1: Organization Registration | Medium | High     | **P1**   |
| 2: Automated Provisioning    | High   | High     | **P1**   |
| 3: Umbrella Dashboard        | High   | High     | **P2**   |
| 4: Billing Integration       | High   | Medium   | **P2**   |
| 5: Production Hardening      | Medium | High     | **P3**   |

---

## Current Sprint

**Focus**: Phase 0 - Schema Redesign

- [ ] Create Registry migration for organizations table
- [ ] Create Registry migration for affiliations table
- [ ] Create Registry migration for subscriptions table
- [ ] Update vaults table with org_id
- [ ] Test migrations locally
- [ ] Document schema in DATABASE-SCHEMA.md

---

## Related Documents

- [UMBRELLA-ORGANIZATIONS.md](UMBRELLA-ORGANIZATIONS.md) - Business model specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) - Current vault schema
- [CONCERNS.md](CONCERNS.md) - Open questions and risks

---

_Last updated: 2026-02-01_
