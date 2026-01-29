# Score Library Design Document

**Status**: Draft for Review  
**Date**: 2025-01-29  
**Epic**: TBD

---

## Overview

The Score Library manages musical works, their editions, and physical/digital assets. Designed for professional ensembles (choirs, orchestras) who need to track both digital files and physical score inventory.

---

## Core Concepts

### Hierarchy

```
WORK (abstract composition)
  └── EDITION (specific publication/arrangement)
        ├── DIGITAL ASSET (PDF, MP3, or link to YouTube/Spotify/etc, optional)
        └── PHYSICAL COPIES (inventory, optional)
              └── COPY ASSIGNMENTS (who has what)
```

### Examples

**Work**: "Messiah" by Handel

- **Edition**: Novello Vocal Score → 40 physical copies + PDF
- **Edition**: Novello Soprano Part → 15 physical copies
- **Edition**: CPDL Transcription → PDF only
- **Edition**: Rehearsal Audio → YouTube link
- **Edition**: Reference Recording → Spotify link

**Work**: "O Magnum Mysterium" by Victoria

- **Edition**: IMSLP Public Domain → PDF only
- **Edition**: Our choir's transcription → PDF only
- **Edition**: Tenebrae Performance → Vimeo link

---

## Data Model

### Works

Abstract compositions. Minimal metadata.

| Column     | Type          | Notes                                  |
| ---------- | ------------- | -------------------------------------- |
| id         | TEXT PK       |                                        |
| title      | TEXT NOT NULL |                                        |
| composer   | TEXT          | nullable (traditional/anonymous)       |
| lyricist   | TEXT          | nullable (liturgical/traditional text) |
| created_at | DATETIME      |                                        |

### Editions

Specific publications or arrangements of a work.

| Column           | Type          | Notes                                                                                           |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| id               | TEXT PK       |                                                                                                 |
| work_id          | TEXT FK       | → works.id                                                                                      |
| name             | TEXT NOT NULL | "Novello Vocal Score", "CPDL Transcription"                                                     |
| arranger         | TEXT          | nullable                                                                                        |
| publisher        | TEXT          | nullable                                                                                        |
| voicing          | TEXT          | free text: "SATB div.", "SSA", etc.                                                             |
| edition_type     | TEXT          | 'full_score' \| 'vocal_score' \| 'part' \| 'reduction' \| 'audio' \| 'video' \| 'supplementary' |
| license_type     | TEXT          | 'public_domain' \| 'licensed' \| 'owned'                                                        |
| notes            | TEXT          |                                                                                                 |
| external_url     | TEXT          | Link to YouTube/Spotify/SoundCloud/Vimeo/IMSLP (nullable)                                       |
| file_key         | TEXT          | D1 storage reference for uploaded file (nullable)                                               |
| file_name        | TEXT          | original filename (nullable)                                                                    |
| file_size        | INTEGER       | bytes (nullable)                                                                                |
| file_uploaded_at | DATETIME      |                                                                                                 |
| file_uploaded_by | TEXT FK       | → members.id                                                                                    |
| created_at       | DATETIME      |                                                                                                 |

**Design decisions**:

- Edition can have: file only, link only, both, or neither (physical copies only)
- Audio tracks, voice parts, video references = separate editions
- External links open in new tab; uploaded files use in-app viewer/player

### Edition Sections

Editions link to sections via `edition_sections` junction table. This enables:

1. **Coverage validation**: "Warning: No editions selected for Bass section"
2. **Inventory planning**: "12 singers in T1+T2, only 10 Tenor Parts available"
3. **What to bring**: Show only editions relevant to singer's section
4. **Assignment validation**: "Copy assigned to singer in wrong section"

| Column      | Type    | Notes                    |
| ----------- | ------- | ------------------------ |
| edition_id  | TEXT FK | → editions.id            |
| section_id  | TEXT FK | → sections.id            |
| PRIMARY KEY |         | (edition_id, section_id) |

**Rules**:

- Empty = universal (Full Scores, audio, reference recordings)
- Populated = section-specific (Soprano Part → S1, S2)
- UI warns when singer's section doesn't match assigned edition's sections
- Reports surface "section changes requiring copy swaps"

### Physical Copies

Individual numbered copies of an edition.

| Column      | Type          | Notes                                |
| ----------- | ------------- | ------------------------------------ |
| id          | TEXT PK       |                                      |
| edition_id  | TEXT FK       | → editions.id                        |
| copy_number | TEXT NOT NULL | Manual entry: "1", "2", "A", etc.    |
| condition   | TEXT          | 'good' \| 'fair' \| 'poor' \| 'lost' |
| acquired_at | DATE          |                                      |
| notes       | TEXT          |                                      |
| created_at  | DATETIME      |                                      |

**Calculated values**:

- Total copies = COUNT(\*) WHERE edition_id = ?
- Available = COUNT(\*) WHERE condition != 'lost' AND no active assignment
- Assigned = COUNT(\*) with active assignment

### Copy Assignments

Track who has which physical copy.

| Column      | Type     | Notes                     |
| ----------- | -------- | ------------------------- |
| id          | TEXT PK  |                           |
| copy_id     | TEXT FK  | → physical_copies.id      |
| member_id   | TEXT FK  | → members.id              |
| assigned_at | DATETIME |                           |
| returned_at | DATETIME | null = currently assigned |
| assigned_by | TEXT FK  | → members.id              |
| notes       | TEXT     |                           |

**Assignment history** preserved. Query current assignments: `WHERE returned_at IS NULL`

---

## Seasons

Date-based grouping for events. **Derived membership** - events belong to seasons by date, not explicit FK.

| Column     | Type                 | Notes                              |
| ---------- | -------------------- | ---------------------------------- |
| id         | TEXT PK              |                                    |
| name       | TEXT NOT NULL        | "Fall 2025", "Spring Concert 2026" |
| start_date | DATE NOT NULL UNIQUE | Defines boundary                   |
| created_at | DATETIME             |                                    |

**Validation**: No overlapping seasons (unique start_date is sufficient).

**Query** to find event's season:

```sql
SELECT * FROM seasons
WHERE start_date <= :event_date
ORDER BY start_date DESC
LIMIT 1
```

**Query** to find season's events:

```sql
SELECT e.* FROM events e
WHERE e.starts_at >= :season_start_date
  AND e.starts_at < COALESCE(
    (SELECT start_date FROM seasons
     WHERE start_date > :season_start_date
     ORDER BY start_date ASC
     LIMIT 1),
    '9999-12-31'
  )
ORDER BY e.starts_at
```

**Required indexes**:

- `seasons.start_date` - already indexed via UNIQUE constraint
- `events.starts_at` - already indexed (`idx_events_starts_at`)

---

## Repertoire Linking

Two-stage selection: Works (ordered) → Editions (selected).

### Season Repertoire

| Table                | Purpose                        |
| -------------------- | ------------------------------ |
| season_works         | Works for this season, ordered |
| season_work_editions | Which editions of each work    |

```sql
season_works (
  id TEXT PK,
  season_id TEXT FK,
  work_id TEXT FK,
  display_order INTEGER,
  added_at DATETIME,
  added_by TEXT FK
)

season_work_editions (
  season_work_id TEXT FK,
  edition_id TEXT FK,
  PRIMARY KEY (season_work_id, edition_id)
)
```

### Event Repertoire

Same structure, for event-specific selections.

```sql
event_works (
  id TEXT PK,
  event_id TEXT FK,
  work_id TEXT FK,
  display_order INTEGER,
  added_at DATETIME,
  added_by TEXT FK
)

event_work_editions (
  event_work_id TEXT FK,
  edition_id TEXT FK,
  PRIMARY KEY (event_work_id, edition_id)
)
```

### UI Behavior

When selecting repertoire for an event:

1. **Season works shown first** (as suggestions)
2. **All other works available** (for ad-hoc additions)
3. No constraint - events can have works not in season

---

## User Stories

### Librarian Workflows

1. **Add a new work and edition**
   - Create work (title, composer)
   - Create edition (name, publisher, voicing, license)
   - Upload PDF (optional)
   - Add physical copies (optional)

2. **Record score purchase**
   - Find or create work
   - Create edition for this publication
   - Add N physical copies:
     - Enter quantity (e.g., 25)
     - Optional prefix (e.g., "M-" for Messiah)
     - UI pre-fills with zero-padded numbers: "M-01", "M-02", ... "M-25"
     - User can edit individual numbers before saving

3. **Assign scores to members**
   - Select edition → see available copies
   - Assign copy #X to Member Y
   - System records assignment date + who assigned

4. **Collect scores after season**
   - View all assigned copies for season's editions
   - Mark each as returned (or lost/damaged)

5. **Prepare event repertoire**
   - Select works (in performance order)
   - For each work, select relevant editions
   - View: who needs which copies

### Singer Workflows

1. **View my assigned scores** (profile page, private to singer)
   - See list of physical copies I have
   - Access digital versions (if available)

2. **View event repertoire**
   - See what we're rehearsing
   - Download PDFs for my editions

---

## Permissions

| Action                         | Roles                   |
| ------------------------------ | ----------------------- |
| View works/editions            | All members             |
| Download files                 | All members             |
| Create/edit works              | Librarian, Admin, Owner |
| Manage physical copies         | Librarian, Admin, Owner |
| Assign/collect copies          | Librarian, Admin, Owner |
| Manage season/event repertoire | Conductor, Admin, Owner |

---

## Implementation Phases

### Phase A: Core Catalog

**Works CRUD** (**C**reate, **R**ead, **U**pdate, **D**elete):

| Layer        | Deliverable                                           |
| ------------ | ----------------------------------------------------- |
| **Database** | `src/lib/server/db/works.ts` - functions + unit tests |
| **API**      | `src/routes/api/works/+server.ts` - endpoints + tests |
| **UI**       | `/works` list, `/works/new` form, `/works/[id]` edit  |
| **E2E**      | Playwright tests if complex flows                     |

- Editions CRUD (with file upload)
- Edition browser (list, search, filter)
- PDF viewer

### Phase B: Physical Inventory

- Physical copies CRUD
- Copy assignment/return
- "My scores" section on profile page (private to singer)
- Inventory reports

### Phase C: Seasons & Repertoire

- Seasons CRUD
- Season repertoire management
- Event repertoire (works + editions)
- "What to bring" section on event page (personalized: shows singer's assigned copies + download links for the event's editions)

### Phase D: Reports & Insights

- Missing copies report
- Assignment history
- "Who has edition X" query
- Collection reminders

---

## Open Questions

1. **Barcode/QR**: Future support for scanning copy numbers?

2. **Multi-vault federation**: How do shared editions work across trusted vaults?

3. **IMSLP integration**: Auto-import PD editions from IMSLP?

---

## Appendix: Full Schema SQL

```sql
-- Works (abstract compositions)
CREATE TABLE works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  composer TEXT,
  lyricist TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Editions (specific publications)
CREATE TABLE editions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  arranger TEXT,
  publisher TEXT,
  voicing TEXT,
  edition_type TEXT CHECK (edition_type IN ('full_score', 'vocal_score', 'part', 'reduction', 'audio', 'video', 'supplementary')),
  license_type TEXT CHECK (license_type IN ('public_domain', 'licensed', 'owned')),
  notes TEXT,
  external_url TEXT,  -- YouTube, Spotify, SoundCloud, Vimeo, IMSLP, etc.
  file_key TEXT,      -- D1 storage reference (can coexist with external_url)
  file_name TEXT,
  file_size INTEGER,
  file_uploaded_at DATETIME,
  file_uploaded_by TEXT REFERENCES members(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Physical copies
CREATE TABLE physical_copies (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  copy_number TEXT NOT NULL,
  condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'lost')),
  acquired_at DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edition_id, copy_number)
);

-- Copy assignments
CREATE TABLE copy_assignments (
  id TEXT PRIMARY KEY,
  copy_id TEXT NOT NULL REFERENCES physical_copies(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME,
  assigned_by TEXT REFERENCES members(id),
  notes TEXT
);
CREATE INDEX idx_copy_assignments_active ON copy_assignments(copy_id) WHERE returned_at IS NULL;

-- Edition sections (which sections use this edition)
CREATE TABLE edition_sections (
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  PRIMARY KEY (edition_id, section_id)
);

-- Seasons
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Season repertoire (works)
CREATE TABLE season_works (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  added_by TEXT REFERENCES members(id),
  UNIQUE (season_id, work_id)
);

-- Season repertoire (editions per work)
CREATE TABLE season_work_editions (
  season_work_id TEXT NOT NULL REFERENCES season_works(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  PRIMARY KEY (season_work_id, edition_id)
);

-- Event repertoire (works)
CREATE TABLE event_works (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  added_by TEXT REFERENCES members(id),
  UNIQUE (event_id, work_id)
);

-- Event repertoire (editions per work)
CREATE TABLE event_work_editions (
  event_work_id TEXT NOT NULL REFERENCES event_works(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  PRIMARY KEY (event_work_id, edition_id)
);
```

---

_Document ready for review. Feedback welcome before creating Epic issue._
