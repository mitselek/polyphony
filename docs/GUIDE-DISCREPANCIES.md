# Guide Discrepancies

Audit of Estonian guides against codebase, performed 2026-02-18 after Sprint 1 (PR #248).

---

## Discrepancy: Settings page access is not owner-only

- **Found in**: `apps/vault/src/lib/content/guides/admin-et.md` (lines 102, 141)
- **Claim**: The permissions table shows Settings management as owner-only (Admin = no). Line 141: "Ainult **omanik** pääseb ligi seadete lehele" (Only owner can access settings).
- **Reality**: The settings page uses `assertAdmin()` which allows both `admin` AND `owner` roles. The nav config (`src/lib/nav.ts:28`) also shows settings visible to `['admin', 'owner']`.
- **Assessment**: outdated
- **Recommendation**: update guide -- change the permissions table to show Admin = yes for "Seadete haldamine", and rewrite line 141 to say "Omanik ja administraator pääsevad ligi seadete lehele".

---

## Discrepancy: Librarian guide lists "External URL" as an edition type

- **Found in**: `apps/vault/src/lib/content/guides/librarian-et.md` (lines 46-51)
- **Claim**: Edition types listed as: Full Score, Vocal Score, Part, Reduction, Audio, External URL.
- **Reality**: Actual edition types in code (`src/lib/types.ts`): `full_score`, `vocal_score`, `part`, `reduction`, `audio`, `video`, `supplementary`. "External URL" is a field on any edition (`external_url TEXT`), not a separate type. The guide is also missing `video` and `supplementary` types.
- **Assessment**: hallucination (External URL as type) + outdated (missing video/supplementary)
- **Recommendation**: update guide -- replace "External URL" with the actual types. Mention that any edition can optionally include an external URL link.

---

## Discrepancy: Trust Individual Responsibility description incomplete

- **Found in**: `apps/vault/src/lib/content/guides/admin-et.md` (line 112)
- **Claim**: "Vaikimisi on see lubada ainult administraatoritel ja dirigentidel" (By default, only admins and conductors can do this).
- **Reality**: The `canEditParticipation()` function in `permissions.ts` also grants this to `section_leader` and `owner` roles. The roster view code explicitly checks `['conductor', 'section_leader', 'owner']`.
- **Assessment**: outdated
- **Recommendation**: update guide -- change to "administraatoritel, omanikul, dirigentidel ja häälerühma vanematel" (admins, owners, conductors, and section leaders).

---

## Discrepancy: Roster is described as a menu item

- **Found in**: `apps/vault/src/lib/content/guides/section-leader-et.md` (line 47)
- **Claim**: "Vali menüüst **'Roster'**" (Choose "Roster" from the menu).
- **Reality**: Roster is NOT a nav menu item. It's the landing page (`/events/roster`) accessed via the org name link or via a button on the Events page. The nav config (`src/lib/nav.ts:18`) explicitly notes: "Roster is NOT here -- it's the home/landing page for logged-in users".
- **Assessment**: outdated
- **Recommendation**: update guide -- change to "Ava **'Events'** leht ja kliki **'Roster'** nupule" (Open the Events page and click the Roster button), or mention that Roster is the landing page when logging in.

---

## Discrepancy: Owner cannot add scores (permissions table correct, but prose misleading)

- **Found in**: `apps/vault/src/lib/content/guides/admin-et.md` (line 129)
- **Claim**: "**Raamatukoguhoidja** (või omanik) avab **'Works'**" -- implies Owner can add works.
- **Reality**: Owner does NOT have `scores:upload` permission. The `canUploadScores` check only passes for `librarian` role. An owner would need to also have the librarian role to upload.
- **Assessment**: hallucination
- **Recommendation**: update guide -- change "(või omanik)" to "(või omaniku rolliga liige, kellel on ka raamatukoguhoidja roll)" or simply remove the parenthetical. The permissions table on line 97 is correct (Owner = no for score upload), but the prose contradicts it.

---

## Discrepancy: Owner cannot create events (permissions table correct, but prose misleading)

- **Found in**: `apps/vault/src/lib/content/guides/admin-et.md` (line 135)
- **Claim**: "**Dirigent** (või omanik) avab **'Events'**" -- implies Owner can create events.
- **Reality**: Owner does NOT have `events:create` permission. Only conductor role has event management permissions. An owner would need the conductor role to create events.
- **Assessment**: hallucination
- **Recommendation**: update guide -- remove "(või omanik)" or clarify that owner needs conductor role. The permissions table on line 100 is correct (Owner = no for event creation), but the prose contradicts it.

---

## Discrepancy: Attendance icons described as specific colors/shapes

- **Found in**: `apps/vault/src/lib/content/guides/section-leader-et.md` (lines 37-39)
- **Claim**: Present = green checkmark, Late = yellow clock, Absent = red cross.
- **Reality**: The actual UI uses StatusPicker buttons, but the specific icon/color rendering may differ from what's described. The status values `present`, `absent`, `late` are correct, but the visual description is aspirational.
- **Assessment**: aspirational feature (minor)
- **Recommendation**: verify against live UI and update if icons differ. Low priority.

---

## Discrepancy: Admin guide claims "Add Roster Member" is the button text

- **Found in**: `apps/vault/src/lib/content/guides/admin-et.md` (line 122)
- **Claim**: Clicks **"Add Roster Member"** button.
- **Reality**: The button text comes from `m.members_add_roster_btn()` i18n key. If the user is viewing in Estonian, this should be the Estonian translation, not the English text. The guide uses English UI labels inside an Estonian guide.
- **Assessment**: outdated (minor, cosmetic)
- **Recommendation**: verify Estonian translations of button labels and use those in the guide, or note that UI labels depend on language settings. Low priority since users will see the actual labels.
