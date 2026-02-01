# Umbrella Organizations Specification

Business model and technical architecture for multi-tier organization support in Polyphony.

**Status**: Draft  
**Author**: @mitselek  
**Created**: 2026-02-01

---

## 1. Overview

Polyphony supports three tiers of organizations:

| Tier                       | Example                           | Payment                              | Vault Access                     |
| -------------------------- | --------------------------------- | ------------------------------------ | -------------------------------- |
| **Umbrella Organization**  | Estonian Mixed Choirs Association | €10/mo base + €1/GB (aggregate)      | Dashboard + own vault (optional) |
| **Affiliated Collective**  | Choir under umbrella              | Free (covered by umbrella)           | Own vault at `name.polyphony.uk` |
| **Independent Collective** | Self-paying choir/band            | Free ≤100MB, €3 ≤1GB, €10 ≤10GB     | Own vault at `name.polyphony.uk` |

### Key Principles

1. **Umbrella pays for affiliates** - Choirs under an umbrella don't pay individually
2. **Multi-umbrella allowed** - A collective can belong to multiple umbrellas
3. **Flat subdomain structure** - All vaults get `name.polyphony.uk` (not nested)
4. **Registry manages billing** - Subscription/payment logic lives in Registry, not Vaults
5. **Vaults are independent** - Umbrella affiliation is billing relationship, not data access
6. **Collectives can move** - A choir can leave one umbrella and join another (or go independent)
7. **30-day trial** - New independents get 30 days free with full features

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGISTRY (polyphony.uk)                      │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Auth Gateway  │  │    Billing &    │  │  Vault          │ │
│  │   (OAuth/Email) │  │  Subscriptions  │  │  Provisioning   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                     │            │
│                              ▼                     ▼            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Registry Database                      │  │
│  │  • organizations (umbrellas + independents)               │  │
│  │  • vaults (with org_id foreign key)                       │  │
│  │  • subscriptions (billing state)                          │  │
│  │  • usage_reports (for aggregated stats)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
   │ kamariit        │ │ voces           │ │ rockband        │
   │ .polyphony.uk   │ │ .polyphony.uk   │ │ .polyphony.uk   │
   │                 │ │                 │ │                 │
   │ Affiliated with │ │ Affiliated with │ │ Independent     │
   │ "segakoorid"    │ │ "kammerkoorid"  │ │ (self-paying)   │
   └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 3. Organization Types

### 3.1 Umbrella Organization

An association or federation that pays for multiple member collectives.

**Examples**:

- Estonian Mixed Choirs Association (Eesti Segakooride Liit)
- Chamber Choirs Association (Kammerkooride Liit)
- Regional choir federation

**Capabilities**:

- View list of affiliated vaults
- See aggregated statistics:
  - Total member count across affiliates
  - Concert/event calendar (public events only)
  - Active vault count
- Manage affiliation requests (approve/remove)
- Access billing dashboard
- **Own vault** (optional): If umbrella is also a performing collective
  - Can selectively share scores with affiliates
  - Can selectively share events with affiliates

**Does NOT have**:

- Direct access to affiliate vault content (scores, private events)
- Ability to manage affiliate vault members

### 3.2 Affiliated Collective

A choir/orchestra/band that belongs to an umbrella organization.

**Billing**: Free (umbrella pays)

**Vault Features**: Full access to all vault features:

- Score library
- Member management
- Events & attendance
- Seasons & repertoire

**Affiliation Rules**:

- Can belong to **multiple umbrellas** simultaneously
- Each umbrella pays proportionally for the collective's storage
- Can leave umbrella → 30-day grace period → becomes independent (must start paying)
- Can switch/add umbrellas (with approval from new umbrella)

### 3.3 Independent Collective

A self-paying choir/orchestra/band with no umbrella affiliation.

**Billing**: Tiered storage-based pricing

| Storage | Monthly Price |
| ------- | ------------- |
| ≤100 MB | Free |
| ≤1 GB | €3/mo |
| ≤10 GB | €10/mo |

**Trial**: 30 days free with full features for new collectives.

**Vault Features**: Same as affiliated collective

---

## 4. Registry Database Schema

### 4.1 New Tables

```sql
-- Organization types: 'umbrella' or 'collective'

CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,  -- URL-safe identifier
    type TEXT NOT NULL CHECK (type IN ('umbrella', 'collective')),
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: collectives can belong to multiple umbrellas
CREATE TABLE affiliations (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    is_primary BOOLEAN NOT NULL DEFAULT 0,  -- Primary umbrella pays full storage
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(collective_id, umbrella_id)
);

-- Subscription/billing state
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id),
    plan TEXT NOT NULL CHECK (plan IN ('free', 'tier1', 'tier2', 'umbrella', 'trial')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trial', 'grace')),
    trial_ends_at TEXT,  -- For 30-day trial
    grace_ends_at TEXT,  -- For 30-day grace period
    current_period_start TEXT,
    current_period_end TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Affiliation requests (pending umbrella approvals)
CREATE TABLE affiliation_requests (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    requested_by TEXT NOT NULL,  -- email of requester
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    responded_by TEXT,
    responded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usage reports from vaults (for aggregated stats and billing)
CREATE TABLE usage_reports (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    report_date TEXT NOT NULL,  -- YYYY-MM-DD
    member_count INTEGER NOT NULL,
    score_count INTEGER NOT NULL,
    storage_bytes INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(vault_id, report_date)
);
```

### 4.2 Updated Vaults Table

```sql
-- Add organization relationship to existing vaults table
ALTER TABLE vaults ADD COLUMN org_id TEXT REFERENCES organizations(id);
```

---

## 5. Subdomain System

### 5.1 Structure

All vaults get a subdomain under `polyphony.uk`:

```
kamariit.polyphony.uk     -- Affiliated collective
voces.polyphony.uk        -- Affiliated collective
rockband.polyphony.uk     -- Independent collective
```

**No nesting**: Even if "kamariit" belongs to "segakoorid", they don't get `kamariit.segakoorid.polyphony.uk`. This keeps DNS simple and allows collectives to change affiliations without URL changes.

### 5.2 Subdomain Validation Rules

| Rule                             | Example Valid | Example Invalid       |
| -------------------------------- | ------------- | --------------------- |
| Lowercase alphanumeric + hyphens | `my-choir`    | `My_Choir`            |
| 3-63 characters                  | `abc`         | `ab`                  |
| Cannot start/end with hyphen     | `my-choir`    | `-mychoir-`           |
| Cannot be reserved               | `choir123`    | `www`, `api`, `admin` |
| Must be unique                   | (first come)  | (duplicate)           |

**Reserved subdomains**:

- `www`, `api`, `admin`, `auth`, `login`
- `vault`, `registry`, `static`, `assets`
- `mail`, `smtp`, `imap`, `pop`
- `ftp`, `ssh`, `vpn`

### 5.3 DNS Automation

When a vault is provisioned:

1. Registry creates Cloudflare Pages project: `polyphony-vault-{slug}`
2. Registry adds custom domain via Cloudflare API: `{slug}.polyphony.uk`
3. Cloudflare auto-provisions SSL certificate
4. Vault is accessible at `https://{slug}.polyphony.uk`

**Required Cloudflare API permissions**:

- `Zone:DNS:Edit` - Create CNAME records
- `Pages:Edit` - Create projects and add domains

---

## 6. Umbrella Dashboard

Umbrella organizations access a dashboard at `polyphony.uk/dashboard/umbrella/{slug}`.

### 6.1 Features

**Affiliate Management**:

- List of affiliated collectives (name, subdomain, join date)
- Pending affiliation requests (approve/reject)
- Remove affiliate (with confirmation)

**Aggregated Statistics**:

- Total member count across all affiliates
- Active vaults count
- Public events calendar (concerts, festivals)
- Storage usage summary

**Billing**:

- Current plan and pricing tier
- Invoice history
- Payment method management
- Usage breakdown by affiliate

### 6.2 Data Access Boundaries

Umbrella orgs can see:

- ✅ Aggregate counts (members, scores, events)
- ✅ Public event details (concerts listed as public)
- ✅ Vault status (active/inactive)
- ✅ Storage usage per affiliate (for billing transparency)

Umbrella orgs CANNOT see:

- ❌ Individual member names/emails
- ❌ Affiliate score library contents
- ❌ Private events or rehearsals
- ❌ Attendance records

### 6.3 Umbrella Vault Sharing (Optional)

If an umbrella has its own vault (as a performing collective), it can:

- **Share scores** selectively with affiliates (one-way push)
- **Share events** selectively with affiliates (festival announcements, workshops)

This is NOT federation - just umbrella → affiliate visibility. Affiliates cannot share back to umbrella through this mechanism.

---

## 7. Vault Provisioning Flow

### 7.1 New Affiliated Collective

```
1. Collective admin visits polyphony.uk/register
2. Selects "Join an umbrella organization"
3. Searches/selects umbrella (e.g., "Eesti Segakooride Liit")
4. Fills in collective details:
   - Name: "Kammerkoor Voces Musicales"
   - Preferred subdomain: "voces"
   - Contact email: admin@voces.ee
5. Submits request → Affiliation request created
6. Umbrella admin receives notification
7. Umbrella admin approves request
8. Registry provisions vault:
   - Creates Cloudflare Pages project
   - Adds custom domain
   - Creates vault database
   - Sends welcome email to collective admin
9. Collective admin can now access voces.polyphony.uk
```

### 7.2 New Independent Collective

```
1. Collective admin visits polyphony.uk/register
2. Selects "Register as independent"
3. Fills in collective details + subdomain
4. 30-day trial starts immediately (no payment required)
5. Vault provisioned → collective admin accesses their vault
6. Before trial ends: prompted to add payment method
7. After trial: tiered pricing based on storage usage
```

### 7.3 Existing Independent → Joins Umbrella

```
1. Independent collective admin requests affiliation
2. Umbrella approves
3. Registry creates affiliation record (can have multiple)
4. If primary umbrella: subscription cancelled (umbrella covers cost)
5. Vault URL unchanged (subdomain stays the same)
```

### 7.4 Collective Leaves Umbrella

```
1. Collective or umbrella initiates separation
2. 30-day grace period starts
3. During grace: vault fully functional, negotiate next steps
4. Options:
   a) Join another umbrella (no interruption)
   b) Start paying as independent
   c) Data export + vault archived
5. After grace with no resolution: vault becomes read-only
```

---

## 8. Billing Model

### 8.1 Umbrella Pricing

**Base fee + linear storage**:

| Component | Price              |
| --------- | ------------------ |
| Base fee  | €10/mo             |
| Storage   | €1/GB (rounded up) |

**Rules**:

- Base fee covers dashboard, aggregation, and support
- Sum storage across all affiliated vaults
- Charge €1 per GB, **always rounded up**
- Archived/inactive data counts toward storage

**Examples**:

| Affiliates | Total Storage | Monthly Cost |
| ---------- | ------------- | ------------ |
| 3 choirs | 800 MB | €10 + €1 = **€11/mo** |
| 10 choirs | 4.2 GB | €10 + €5 = **€15/mo** |
| 25 choirs | 12 GB | €10 + €12 = **€22/mo** |

### 8.2 Independent Pricing

**Tiered storage-based pricing**:

| Storage | Monthly Price |
| ------- | ------------- |
| ≤100 MB | Free          |
| ≤1 GB   | €3/mo         |
| ≤10 GB  | €10/mo        |

**Rules**:

- Archived/inactive data counts toward storage
- No pro-rating within tiers

### 8.3 Why Join an Umbrella?

**Cost comparison** (10 choirs, ~500 MB each = 5 GB total):

| Model           | Calculation | Monthly Cost |
| --------------- | ----------- | ------------ |
| As independents | 10 × €3/mo  | **€30/mo**   |
| Under umbrella  | €10 + €5    | **€15/mo**   |

Umbrella membership saves ~50% at typical usage.

### 8.4 Payment Provider

**Stripe** for payment processing:

- Subscription management
- Invoice generation
- Payment method storage
- Webhook handling for status updates

---

## 9. Implementation Phases

### Phase 1: Manual Provisioning

- Single vault at `vault.polyphony.uk` (current)
- No subdomain system yet
- Manual Cloudflare setup for additional vaults

### Phase 2: Registry Schema + UI

- Add organizations/subscriptions tables
- Umbrella dashboard (view-only, no provisioning)
- Organization registration flow

### Phase 3: Automated Vault Provisioning

- Cloudflare API integration
- Automatic subdomain DNS setup
- Vault database creation

### Phase 4: Billing Integration

- Stripe subscription management
- Usage-based pricing (if chosen)
- Invoice generation

### Phase 5: Aggregated Reporting

- Vault → Registry usage reports
- Umbrella statistics dashboard
- Public event aggregation

---

## 10. Resolved Questions

1. ✅ **Umbrella vault**: Umbrellas can have their own vault as an affiliated collective under themselves.
   - Their score library can be selectively shared with affiliates
   - Their events can be selectively shared with affiliates

2. ✅ **Multi-umbrella**: Collectives can belong to multiple umbrellas.
   - Primary umbrella designated for billing (pays full storage cost)
   - Secondary umbrellas get aggregate stats but don't pay

3. ✅ **Vault transfer**: 30-day grace period when collective leaves umbrella.
   - During grace: full functionality, time to negotiate
   - After grace with no resolution: read-only, then archived

4. ✅ **Geographic scope**: No limit. Umbrellas can have affiliates from any country.

5. ✅ **Trial period**: 30 days free trial with full features for independents.

---

## 11. Open Questions

1. **Multi-umbrella billing split**: If a collective has multiple umbrellas, does only the primary pay? Or proportional split?
   - Current design: Primary umbrella pays 100%
   - Alternative: Split by % of storage or equal division

2. **Umbrella-to-affiliate sharing**: Technical implementation for selective score/event sharing
   - Read-only references? Copies? Sync mechanism?

---

## 12. Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical stack and structure
- [GLOSSARY.md](GLOSSARY.md) - Terminology definitions
- [CONCERNS.md](CONCERNS.md) - Open questions and risks
- [LEGAL-FRAMEWORK.md](LEGAL-FRAMEWORK.md) - Liability and compliance

---

_Last updated: 2026-02-01_
