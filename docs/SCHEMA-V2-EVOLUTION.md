# Schema V2: Multi-Organization Architecture

Documenting the unified multi-organization architecture.

**Status**: Current (Implemented)  
**Last Updated**: 2026-02-08

---

## Architecture Fundamentals

1. **Single Vault Deployment**: One vault app hosts ALL organizations. No separate deployments per organization.

2. **Zero-Storage Registry**: Handles auth and discovery only. Queries Vault public APIs. Does NOT store org/user/score data.

---

## Architecture Overview

### Current Architecture: Unified Multi-Organization

```
┌─────────────────────────────────────────────────────────────┐
│ Registry (polyphony.uk)                                     │
│ ├── D1: vaults, signing_keys                                │
│ ├── Stateless auth + SSO cookie on .polyphony.uk            │
│ └── No user storage                                         │
└─────────────────────────────────────────────────────────────┘
        │
        │ OAuth/magic-link + SSO cookie
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Vault (vault.polyphony.uk)                                  │
│ ├── D1: organizations, members, member_organizations, ...   │
│ ├── Single deployment, all orgs                             │
│ └── Subdomains route to same app (org context from URL)     │
└─────────────────────────────────────────────────────────────┘
        │
        │ Subdomain routing
        ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ crede.polyphony  │  │ tallinn.polyphony│  │ eca.polyphony    │
│ (collective)     │  │ (collective)     │  │ (umbrella)       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Benefits:**

- Same person, same identity across all orgs
- Umbrella organizations manage affiliates
- SSO across all subdomains
- Single codebase, single D1

---

## Schema Changes

### Organizations (NEW)

```sql
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,  -- becomes {subdomain}.polyphony.uk
    type TEXT NOT NULL CHECK (type IN ('umbrella', 'collective')),
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX idx_organizations_type ON organizations(type);
```

### Members (MODIFIED)

**V1:**

```sql
members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    email_id TEXT UNIQUE,
    email_contact TEXT,
    invited_by TEXT REFERENCES members(id),
    joined_at TEXT
)
```

**V2:**

```sql
-- Global identity pool
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    email_id TEXT UNIQUE,              -- OAuth identity (null for roster-only)
    name TEXT NOT NULL,                -- default display name
    email_contact TEXT,                -- global contact preference
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_members_email_id ON members(email_id) WHERE email_id IS NOT NULL;
```

**Key changes:**

- Removed `invited_by`, `joined_at` → moved to `member_organizations`
- Removed `nickname` → moved to `member_organizations`
- Members are now global identities, not org-specific

### Member Organizations (NEW)

```sql
-- Junction: who belongs to which org
CREATE TABLE member_organizations (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nickname TEXT,                     -- org-specific display name
    invited_by TEXT REFERENCES members(id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (member_id, org_id)
);

CREATE INDEX idx_member_orgs_org ON member_organizations(org_id);
CREATE INDEX idx_member_orgs_member ON member_organizations(member_id);
```

### Member Roles (MODIFIED)

**V1:**

```sql
member_roles (
    member_id TEXT NOT NULL REFERENCES members(id),
    role TEXT NOT NULL,
    granted_at TEXT,
    granted_by TEXT,
    PRIMARY KEY (member_id, role)
)
```

**V2:**

```sql
-- Roles are now per-organization
CREATE TABLE member_roles (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    granted_by TEXT REFERENCES members(id),  -- global reference
    PRIMARY KEY (member_id, org_id, role)
);

CREATE INDEX idx_member_roles_org ON member_roles(org_id);
CREATE INDEX idx_member_roles_member ON member_roles(member_id);
CREATE INDEX idx_member_roles_role ON member_roles(role);
```

**Key change:** Added `org_id` - same person can be `owner` in one org, `librarian` in another.

### Voices (UNCHANGED - global)

```sql
CREATE TABLE voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,         -- Soprano, Alto, Tenor, Bass...
    abbreviation TEXT NOT NULL,
    category TEXT CHECK (category IN ('vocal', 'instrumental')),
    range_group TEXT,
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);
```

**Rationale:** A singer's vocal capability is intrinsic - you're a tenor everywhere.

### Sections (MODIFIED - per-org)

**V1:**

```sql
sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    parent_section_id TEXT REFERENCES sections(id),
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
)
```

**V2:**

```sql
CREATE TABLE sections (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    parent_section_id TEXT REFERENCES sections(id),
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(org_id, name)
);

CREATE INDEX idx_sections_org ON sections(org_id);
```

**Key change:** Added `org_id` - sections are choir-specific (Choir A's "T1" ≠ Choir B's "T1").

### Member Voices (UNCHANGED - global)

```sql
CREATE TABLE member_voices (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    assigned_at TEXT DEFAULT (datetime('now')),
    assigned_by TEXT REFERENCES members(id),
    notes TEXT,
    PRIMARY KEY (member_id, voice_id)
);
```

**Rationale:** Voice capability is global - assigned once, applies everywhere.

### Member Sections (UNCHANGED structure, org-scoped via FK)

```sql
CREATE TABLE member_sections (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    assigned_by TEXT REFERENCES members(id),
    notes TEXT,
    PRIMARY KEY (member_id, section_id)
);
```

**Note:** Organization scope is implicit via `sections.org_id`.

---

## Role Definitions

### Collective Roles (type='collective')

| Role             | Permissions                                    |
| ---------------- | ---------------------------------------------- |
| `owner`          | Full control, delete vault, manage all roles   |
| `admin`          | Manage members, roles (except owner), settings |
| `librarian`      | Upload/delete scores, manage editions          |
| `conductor`      | Create/manage events, record attendance        |
| `section_leader` | Record attendance                              |

### Umbrella Roles (type='umbrella')

| Role    | Permissions                                   |
| ------- | --------------------------------------------- |
| `owner` | Full control, manage affiliates, billing      |
| `admin` | Manage affiliates, create joint events/scores |

---

## Affiliations

```sql
CREATE TABLE affiliations (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id),
    umbrella_id TEXT NOT NULL REFERENCES organizations(id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at TEXT,  -- NULL = active, set = ended
    UNIQUE(collective_id, umbrella_id, joined_at)  -- history uniqueness
);

-- Only one active affiliation per collective-umbrella pair
CREATE UNIQUE INDEX idx_affiliations_active
ON affiliations(collective_id, umbrella_id)
WHERE left_at IS NULL;

CREATE INDEX idx_affiliations_collective ON affiliations(collective_id);
CREATE INDEX idx_affiliations_umbrella ON affiliations(umbrella_id);
```

**Lifecycle:**

- Active affiliation: `left_at IS NULL`
- End affiliation: Set `left_at` to current timestamp
- Rejoin: Insert new row (old row preserved with `left_at` set)
- Database enforces: only one active affiliation per pair

**Note:** A collective can have multiple active umbrella affiliations (different umbrellas).

---

## Identity Resolution

Same email can appear in multiple contexts:

```
┌─────────────────────────────────────────────────────────────┐
│                    user@example.com                         │
│                           │                                 │
│                    members.id = "m_abc123"                  │
│                           │                                 │
├───────────────────────────┼─────────────────────────────────┤
│ member_organizations      │                                 │
│ ├── (m_abc123, credo)     │ nickname: "Thomas"              │
│ ├── (m_abc123, tallinn)   │ nickname: "Tom"                 │
│ └── (m_abc123, eca)       │ nickname: NULL                  │
├───────────────────────────┼─────────────────────────────────┤
│ member_roles              │                                 │
│ ├── (m_abc123, credo, conductor)                            │
│ ├── (m_abc123, credo, librarian)                            │
│ ├── (m_abc123, tallinn, owner)                              │
│ └── (m_abc123, eca, admin)                                  │
├───────────────────────────┼─────────────────────────────────┤
│ member_voices (global)    │                                 │
│ └── (m_abc123, tenor) is_primary=1                          │
├───────────────────────────┼─────────────────────────────────┤
│ member_sections (per-org) │                                 │
│ ├── (m_abc123, credo_t1)  │ Credo's Tenor 1 section         │
│ └── (m_abc123, tallinn_t) │ Tallinn's Tenor section         │
└─────────────────────────────────────────────────────────────┘
```

---

## SSO Flow

Registry sets a signed JWT cookie on `.polyphony.uk` domain:

```json
{
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "iat": 1234567890,
  "exp": 1234567890 // 30 days
}
```

**Flow:**

1. User visits `crede.polyphony.uk` → no session → redirect to `polyphony.uk/auth`
2. Registry checks SSO cookie → valid → issue vault JWT → redirect back
3. Vault receives JWT, looks up `members` by `email_id`
4. If found → create session with org context
5. If not found → check for pending invite or show "not a member" page

---

## Migration Strategy

### Phase 1: Schema Migration

1. Create `organizations` table
2. Create one organization per existing vault deployment
3. Add `org_id` to `sections`
4. Create `member_organizations` from existing `members`
5. Add `org_id` to `member_roles`
6. Migrate existing data

### Phase 2: Code Updates

1. Update all member queries to include org context
2. Update role checks to include org_id
3. Add organization context to session
4. Update UI to show org switcher (if member in multiple orgs)

### Phase 3: Consolidation

1. Merge existing vault D1 databases into single D1
2. Update subdomain routing
3. Deploy unified vault

---

## Resolved Questions

1. ~~**Roster-only members across orgs** - Can a roster-only member (no email_id) be in multiple orgs?~~ **No** - roster-only members are org-local placeholders. Each org creates their own. On OAuth verification, resolve to global identity (merge if needed).

2. ~~**Events and Scores** - Do these need `org_id` added?~~ **Yes** - all content tables get `org_id`. See [Events & Content](#events--content-per-org) section.

3. ~~**Invites** - How do invites work with member_organizations junction?~~ Invites are org-scoped. On acceptance, resolve to global identity. See [Invite Acceptance Flow](#invite-acceptance-flow) section.

4. ~~**Existing data migration** - How to merge members with same email from different vaults?~~ **N/A** - Currently only one vault exists (Kammerkoor Crede). Migration is straightforward: create org, migrate all data.

---

## Invite Acceptance Flow

When a user accepts an invite via OAuth, resolve to global identity:

| Scenario | Invite has `roster_member_id`? | `email_id` exists in `members`? | Action                                                                                    |
| -------- | ------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------- |
| A        | No                             | No                              | Create `members` row + `member_organizations` row                                         |
| B        | No                             | Yes                             | Add `member_organizations` row to existing member                                         |
| C        | Yes                            | No                              | Upgrade roster member: set `email_id` on existing row                                     |
| D        | Yes                            | Yes                             | **Merge**: transfer roster member's org data to existing global member, delete roster row |

### Scenario D: Merge Flow

When a roster member verifies with an email that already exists globally:

```
Before:
┌─────────────────────────────────────────────────────────────┐
│ members                                                     │
│ ├── m_global (email_id: "user@example.com", name: "Tom")    │
│ └── m_roster (email_id: NULL, name: "Thomas")  ← roster-only│
├─────────────────────────────────────────────────────────────┤
│ member_organizations                                        │
│ ├── (m_global, tallinn)                                     │
│ └── (m_roster, credo)  ← about to verify as user@example.com│
├─────────────────────────────────────────────────────────────┤
│ member_sections                                             │
│ └── (m_roster, credo_t1)                                    │
├─────────────────────────────────────────────────────────────┤
│ participation                                               │
│ └── (m_roster, event_123, ...)                              │
└─────────────────────────────────────────────────────────────┘

After merge:
┌─────────────────────────────────────────────────────────────┐
│ members                                                     │
│ └── m_global (email_id: "user@example.com", name: "Tom")    │
│     ← m_roster deleted                                      │
├─────────────────────────────────────────────────────────────┤
│ member_organizations                                        │
│ ├── (m_global, tallinn)                                     │
│ └── (m_global, credo, nickname: "Thomas")  ← transferred    │
├─────────────────────────────────────────────────────────────┤
│ member_sections                                             │
│ └── (m_global, credo_t1)  ← FK updated                      │
├─────────────────────────────────────────────────────────────┤
│ participation                                               │
│ └── (m_global, event_123, ...)  ← FK updated                │
└─────────────────────────────────────────────────────────────┘
```

**Merge steps:**

1. Find global member by `email_id`
2. Create `member_organizations` (global → invite's org)
3. Transfer org-specific data: `member_sections`, `member_roles`, `participation`
4. Preserve roster member's `name` as `nickname` in new org membership
5. Delete invite
6. Delete roster member (CASCADE handles remaining FKs)

---

## Events & Content (per-org)

All content tables need `org_id` to scope to organizations:

### Events (MODIFIED)

```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('rehearsal', 'concert', 'retreat', 'festival')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    location TEXT,
    notes TEXT,
    created_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_org ON events(org_id);
CREATE INDEX idx_events_date ON events(org_id, start_date);
```

**Key changes:**

- Added `org_id` - events belong to a specific organization
- Added `created_by` as global member reference
- Added composite index on `(org_id, start_date)` for efficient date queries

### Works (MODIFIED)

```sql
CREATE TABLE works (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    composer TEXT,
    lyricist TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_works_org ON works(org_id);
CREATE INDEX idx_works_title ON works(org_id, title);
```

**Key changes:**

- Added `org_id` - works belong to a specific organization
- Added composite index on `(org_id, title)` for efficient title searches within org

### Editions (MODIFIED)

```sql
CREATE TABLE editions (
    id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    -- org_id implicit via works.org_id
    name TEXT NOT NULL,
    arranger TEXT,
    publisher TEXT,
    voicing TEXT,
    edition_type TEXT NOT NULL DEFAULT 'vocal_score',
    license_type TEXT NOT NULL DEFAULT 'owned',
    notes TEXT,
    external_url TEXT,
    file_key TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_uploaded_at TEXT,
    file_uploaded_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_editions_work ON editions(work_id);
```

**Key changes:**

- No direct `org_id` - organization scope inherited via `works.org_id`
- `file_uploaded_by` references global `members(id)`

### Seasons (MODIFIED)

```sql
CREATE TABLE seasons (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, start_date)
);

CREATE INDEX idx_seasons_org ON seasons(org_id);
```

**Key changes:**

- Added `org_id` - seasons belong to a specific organization
- Uniqueness constraint now on `(org_id, start_date)` instead of just `start_date`

### Invites (MODIFIED)

```sql
CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    invited_by TEXT NOT NULL REFERENCES members(id),
    roster_member_id TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_invites_org ON invites(org_id);
CREATE INDEX idx_invites_token ON invites(token);
```

**Key changes:**

- Added `org_id` - invites are scoped to a specific organization
- `invited_by` and `roster_member_id` reference global `members(id)`
- Token remains globally unique (not per-org) for URL simplicity

**Note:** Participation, edition_files, edition_chunks, physical_copies, copy_assignments, season_works, season_work_editions all inherit org context via their parent FK relationships.

---

## Related Documents

- [ROADMAP.md](ROADMAP.md) - Development phases
- [schema/README.md](schema/README.md) - Current schema (split into modules)
- [UMBRELLA-ORGANIZATIONS.md](UMBRELLA-ORGANIZATIONS.md) - Business model

---

_Last updated: 2026-02-01_
