# Umbrella Organizations Specification

Business model and technical architecture for multi-tier organization support in Polyphony.

**Status**: Draft  
**Author**: @mitselek  
**Created**: 2026-02-01

---

## 1. Overview

Polyphony supports three tiers of organizations:

| Tier                       | Example                           | Payment                         | Vault Access                     |
| -------------------------- | --------------------------------- | ------------------------------- | -------------------------------- |
| **Umbrella Organization**  | Estonian Mixed Choirs Association | Monthly (based on member count) | Dashboard + aggregated data      |
| **Affiliated Collective**  | Choir under umbrella              | Free (covered by umbrella)      | Own vault at `name.polyphony.uk` |
| **Independent Collective** | Self-paying choir/band            | Monthly/annual (volume-based)   | Own vault at `name.polyphony.uk` |

### Key Principles

1. **Umbrella pays for affiliates** - Choirs under an umbrella don't pay individually
2. **Flat subdomain structure** - All vaults get `name.polyphony.uk` (not nested)
3. **Registry manages billing** - Subscription/payment logic lives in Registry, not Vaults
4. **Vaults are independent** - Umbrella affiliation is billing relationship, not data access
5. **Collectives can move** - A choir can leave one umbrella and join another (or go independent)

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

**Does NOT have**:

- Direct access to vault content (scores, private events)
- Ability to manage vault members
- A vault of their own (unless they're also a performing collective)

### 3.2 Affiliated Collective

A choir/orchestra/band that belongs to an umbrella organization.

**Billing**: Free (umbrella pays)

**Vault Features**: Full access to all vault features:

- Score library
- Member management
- Events & attendance
- Seasons & repertoire

**Affiliation Rules**:

- Can belong to ONE umbrella at a time
- Can leave umbrella → becomes independent (must start paying)
- Can switch umbrellas (with approval from new umbrella)

### 3.3 Independent Collective

A self-paying choir/orchestra/band with no umbrella affiliation.

**Billing**: Direct payment (monthly or annual)

**Pricing Model** (TBD):

- Option A: Flat rate (e.g., €5/month)
- Option B: Volume-based (member count or storage)
- Option C: Freemium (basic free, premium features paid)

**Vault Features**: Same as affiliated collective

---

## 4. Registry Database Schema

### 4.1 New Tables

```sql
-- Organization types: 'umbrella' or 'collective'
-- Collectives can be affiliated or independent based on umbrella_id

CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,  -- URL-safe identifier
    type TEXT NOT NULL CHECK (type IN ('umbrella', 'collective')),
    umbrella_id TEXT REFERENCES organizations(id),  -- NULL for umbrellas and independents
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Constraint: umbrellas cannot have umbrella_id
    CHECK (type != 'umbrella' OR umbrella_id IS NULL)
);

-- Subscription/billing state
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id),
    plan TEXT NOT NULL CHECK (plan IN ('free', 'basic', 'premium', 'umbrella')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trial')),
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

-- Usage reports from vaults (for aggregated stats)
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

Umbrella orgs CANNOT see:

- ❌ Individual member names/emails
- ❌ Score library contents
- ❌ Private events or rehearsals
- ❌ Attendance records

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
4. Enters payment information (Stripe)
5. Subscription created → vault provisioned immediately
6. Collective admin accesses their vault
```

### 7.3 Existing Independent → Joins Umbrella

```
1. Independent collective admin requests affiliation
2. Umbrella approves
3. Registry updates org relationship
4. Subscription cancelled (umbrella now covers cost)
5. Vault URL unchanged (subdomain stays the same)
```

---

## 8. Billing Model

### 8.1 Umbrella Pricing

**Tiered by affiliate count**:

| Affiliates | Monthly Price  | Per-Affiliate |
| ---------- | -------------- | ------------- |
| 1-5        | €25            | €5.00         |
| 6-15       | €50            | €3.33-€8.33   |
| 16-30      | €80            | €2.67-€5.00   |
| 31+        | €100 + €2/each | ~€3.00        |

### 8.2 Independent Pricing

**Option A - Flat Rate**:

- €5/month or €50/year

**Option B - Usage-Based**:

- Free tier: Up to 20 members, 100MB storage
- Basic (€3/mo): Up to 50 members, 500MB storage
- Premium (€8/mo): Unlimited members, 2GB storage

### 8.3 Payment Provider

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

## 10. Open Questions

1. **Umbrella vault**: Should umbrellas have their own vault if they're also a performing collective?
   - Option A: Separate organization record (umbrella + collective)
   - Option B: Umbrella type with optional vault

2. **Multi-umbrella**: Can a collective belong to multiple umbrellas?
   - Current design: No (simplifies billing)
   - Future consideration: Yes, with primary/secondary designation

3. **Vault transfer**: What happens to vault data if collective leaves umbrella and stops paying?
   - Grace period? Data export? Archival?

4. **Geographic scope**: Are umbrellas limited to specific countries/regions?
   - Affects pricing, payment currencies, legal jurisdiction

5. **Trial period**: Free trial before requiring payment for independents?
   - 14 days? 30 days? Limited features?

---

## 11. Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical stack and structure
- [GLOSSARY.md](GLOSSARY.md) - Terminology definitions
- [CONCERNS.md](CONCERNS.md) - Open questions and risks
- [LEGAL-FRAMEWORK.md](LEGAL-FRAMEWORK.md) - Liability and compliance

---

_Last updated: 2026-02-01_
