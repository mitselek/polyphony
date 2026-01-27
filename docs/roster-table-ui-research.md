# Roster Table UI Research - Issue #70

Research of existing UI patterns in Polyphony Vault codebase to guide implementation of the Roster Table feature.

**Research Date**: 27 January 2026  
**Target Directory**: `apps/vault/src/routes/`

---

## 1. Table Components

### Finding: **NO NATIVE TABLE COMPONENTS**

The codebase uses **card-based layouts** exclusively—no `<table>` elements found.

**Key Pattern**: Card grid with responsive columns

- Location: [events/+page.svelte](../apps/vault/src/routes/events/+page.svelte#L126)

```svelte
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {#each filteredEvents as event (event.id)}
    <a href="/events/{event.id}" class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <!-- Card content -->
    </a>
  {/each}
</div>
```

**Alternative Pattern**: Vertical stacked cards with flex layout

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L447-L678)

```svelte
<div class="space-y-4">
  {#each filteredMembers as member (member.id)}
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm relative">
      <!-- Member details with inline editing -->
    </div>
  {/each}
</div>
```

**Alternative Pattern**: Simple list with spacing

- Location: [library/+page.svelte](../apps/vault/src/routes/library/+page.svelte#L90-L130)

```svelte
<div class="space-y-4">
  {#each filteredScores as score}
    <div class="flex items-center justify-between rounded-lg border p-4">
      <!-- Score info -->
    </div>
  {/each}
</div>
```

**Recommendation**: Roster Table will need to **introduce the first table component**. Use semantic HTML `<table>` with Tailwind classes for styling.

---

## 2. Sticky Header/Column Implementations

### Finding: **NO STICKY POSITIONING USED**

- Search for `position: sticky`, `position: fixed`, and `sticky` class: **0 results in .svelte files**
- Search in CSS files: **No .css files** (only `app.css` which imports Tailwind)

**Implication**: The sticky header/column pattern is **new to this codebase**.

**Recommended Implementation**:

```svelte
<div class="overflow-x-auto">
  <table class="min-w-full">
    <thead class="sticky top-0 bg-white z-10 border-b-2 border-gray-300">
      <tr>
        <th class="sticky left-0 bg-white z-20">Name</th> <!-- First column also sticky -->
        <!-- Other headers -->
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sticky left-0 bg-white z-10">Member Name</td>
        <!-- Other cells -->
      </tr>
    </tbody>
  </table>
</div>
```

**Note**: Will need to test z-index layering for corner cell (name header).

---

## 3. Color-Coded Status Displays

### Finding: **EXTENSIVE USE OF COLOR-CODED BADGES**

#### Event Type Badges (3 colors)

- Location: [events/+page.svelte](../apps/vault/src/routes/events/+page.svelte#L33-L43)

```typescript
function getEventTypeColor(type: EventType): string {
  switch (type) {
    case "rehearsal":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "concert":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "retreat":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
```

Display pattern:

```svelte
<span class="inline-block rounded-full border px-3 py-1 text-xs font-medium {getEventTypeColor(event.event_type)}">
  {event.event_type}
</span>
```

#### Role Badges (5 colors + multi-select)

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L328-L342)

```typescript
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "owner":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "admin":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "librarian":
      return "bg-green-100 text-green-800 border-green-200";
    case "conductor":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "section_leader":
      return "bg-teal-100 text-teal-800 border-teal-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
```

**Toggleable badge pattern** (role selection):

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L630-L655)

```svelte
<button
  onclick={() => toggleRole(member.id, role)}
  class="rounded-full border px-3 py-1 text-sm font-medium transition {hasRole
    ? getRoleBadgeClass(role)
    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
>
  {#if member.roles.includes(role)}
    ✓ {role}
  {:else}
    + {role}
  {/if}
</button>
```

#### Error/Warning States

- Location: [events/[id]/+page.svelte](../apps/vault/src/routes/events/[id]/+page.svelte#L337-L339)

```svelte
<div class="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
  {error}
</div>
```

#### Expired/Warning Badges

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L383-L387)

```svelte
{#if expired}
  <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
    EXPIRED
  </span>
{/if}
```

**Color Palette Summary**:

- **Green** (`bg-green-100 text-green-800`): Success, active, retreat events
- **Blue** (`bg-blue-100 text-blue-800`): Primary actions, admin role, rehearsals
- **Purple** (`bg-purple-100 text-purple-800`): Owner role, concerts
- **Amber** (`bg-amber-100 text-amber-800`): Warning states, conductor role
- **Teal** (`bg-teal-100 text-teal-800`): Section leader, sections
- **Red** (`bg-red-100 text-red-700`): Errors, expired, delete actions
- **Gray** (`bg-gray-100 text-gray-800`): Neutral, default

**Recommendation for Roster Table**:

- **Present** (attending): `bg-green-100 text-green-800` (✓ icon)
- **Absent**: `bg-red-100 text-red-800` (✗ icon)
- **Excused**: `bg-amber-100 text-amber-800` (E or ⊘ icon)
- **Unknown/No data**: `bg-gray-100 text-gray-500` (• icon or blank)

---

## 4. Filter Implementations

### Pattern 1: Button Toggle Filters (Client-side)

- Location: [events/+page.svelte](../apps/vault/src/routes/events/+page.svelte#L7-L13, L70-L101)

**State Management**:

```typescript
let selectedFilter = $state<EventType | "all">("all");

let filteredEvents = $derived(
  selectedFilter === "all"
    ? data.events
    : data.events.filter((e) => e.event_type === selectedFilter),
);
```

**UI Pattern**:

```svelte
<div class="mb-6 flex gap-2">
  <button
    onclick={() => (selectedFilter = 'all')}
    class="rounded-lg border px-4 py-2 text-sm transition {selectedFilter === 'all'
      ? 'border-blue-500 bg-blue-50 text-blue-700'  <!-- Active state -->
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"  <!-- Inactive -->
  >
    All Events
  </button>
  <!-- More filter buttons -->
</div>
```

### Pattern 2: Text Search Filter (Client-side)

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L13, L33-L38)

```typescript
let searchQuery = $state("");

let filteredMembers = $derived(
  members.filter(
    (m) =>
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
  ),
);
```

```svelte
<input
  type="text"
  bind:value={searchQuery}
  placeholder="Search by email or name..."
  class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
/>
```

### Pattern 3: Date Input (Form Field)

- Location: [events/new/+page.svelte](../apps/vault/src/routes/events/new/+page.svelte#L244-L255)

```svelte
<div>
  <label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
    Start Date <span class="text-red-500">*</span>
  </label>
  <input
    id="start-date"
    type="date"
    bind:value={startDate}
    class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
    required
  />
</div>
```

### Pattern 4: Server-side Query Params (Takedowns API)

- Location: [api/takedowns/+server.ts](../apps/vault/src/routes/api/takedowns/+server.ts#L24)

```typescript
const status = url.searchParams.get("status") as
  | "pending"
  | "approved"
  | "rejected"
  | null;
```

**Recommendation for Roster Table**:

- **Member filter**: Text search (reuse members pattern)
- **Event filter**: Dropdown `<select>` with event titles (not date range—too complex for MVP)
- **Section filter**: Button toggles (reuse events filter pattern)
- **Client-side filtering** (all data loaded at once—simpler for Phase 2)

**Suggested Filter UI**:

```svelte
<div class="mb-6 flex flex-wrap gap-3">
  <!-- Member search -->
  <input
    type="text"
    bind:value={searchQuery}
    placeholder="Search members..."
    class="flex-1 min-w-[200px] rounded-lg border px-4 py-2"
  />

  <!-- Event dropdown -->
  <select bind:value={selectedEventId} class="rounded-lg border px-4 py-2">
    <option value="">All Events</option>
    {#each events as event}
      <option value={event.id}>{event.title}</option>
    {/each}
  </select>

  <!-- Section toggles -->
  <button
    onclick={() => (sectionFilter = 'all')}
    class="rounded-lg border px-4 py-2 {sectionFilter === 'all' ? 'bg-blue-50 border-blue-500' : ''}"
  >
    All Sections
  </button>
  <!-- More section buttons -->
</div>
```

---

## 5. Section Data Display

### Finding: **INLINE BADGE DISPLAYS WITH ABBREVIATIONS**

#### Multi-Section Display (Members Page)

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L586-L625)

**Data Structure**:

```typescript
interface Member {
  sections: Section[]; // Array of section objects
}

interface Section {
  id: string;
  name: string;
  abbreviation: string; // e.g., "S1", "T2", "FC"
  // ... other fields
}
```

**Display Pattern** (with primary indicator):

```svelte
<div class="flex items-center gap-2">
  <span class="text-sm font-medium text-gray-700">Sections:</span>
  {#if member.sections && member.sections.length > 0}
    <div class="flex flex-wrap gap-1">
      {#each member.sections as section, index}
        <span
          class="group relative inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800"
          title="{section.name} {index === 0 ? '(primary)' : ''}"
        >
          {#if index === 0}★{/if} {section.abbreviation}
          <!-- Remove button on hover -->
        </span>
      {/each}
    </div>
  {/if}
</div>
```

**Key Patterns**:

1. **Star icon (★)** indicates primary section (first in array)
2. **Abbreviation shown**, full name in tooltip (`title` attribute)
3. **Color coding**: Teal for sections (`bg-teal-100 text-teal-800`)
4. **Flex wrap** for overflow handling
5. **Inline editing**: Dropdown to add sections (if admin)

#### Similar Pattern for Voices

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L530-L575)
- Uses purple color scheme (`bg-purple-100 text-purple-800`)
- Same star indicator for primary voice

#### Invite Section Assignment

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L410-L422)
- Shows sections in invite context (read-only badges)

**Recommendation for Roster Table**:

- **Column header**: Use abbreviation (e.g., "S1", "T2") with tooltip for full name
- **Cell content**: Display section abbreviation for member if assigned
- **Primary section**: Show in bold or with star icon
- **Color**: Neutral (not teal) since it's data, not a badge
- **Empty state**: Gray dash ("—") if no section assigned

**Example Table Header**:

```svelte
<th class="px-3 py-2 text-xs font-medium text-gray-700" title="Soprano 1">S1</th>
<th class="px-3 py-2 text-xs font-medium text-gray-700" title="Alto 1">A1</th>
```

---

## 6. Responsive Table Patterns

### Finding: **GRID-BASED RESPONSIVE LAYOUTS**

No traditional responsive table patterns (horizontal scroll, stacked cards on mobile) found in codebase.

#### Primary Responsive Pattern: Grid with Breakpoints

- Location: [events/+page.svelte](../apps/vault/src/routes/events/+page.svelte#L126)

```svelte
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <!-- Cards automatically reflow -->
</div>
```

**Breakpoints**:

- Default (mobile): 1 column
- `md:` (768px+): 2 columns
- `lg:` (1024px+): 3 columns

#### Form Grid Pattern

- Location: [events/new/+page.svelte](../apps/vault/src/routes/events/new/+page.svelte#L240)

```svelte
<div class="grid gap-4 md:grid-cols-2">
  <!-- Form fields side-by-side on desktop -->
</div>
```

#### Flex Wrap Pattern (Inline Elements)

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L530)

```svelte
<div class="flex flex-wrap gap-1">
  <!-- Badges wrap to next line if needed -->
</div>
```

#### Container Max-Width Pattern

All pages use centered container with max-width:

```svelte
<div class="container mx-auto max-w-6xl px-4 py-8">
  <!-- Content constrained to readable width -->
</div>
```

**Max-width values by page type**:

- `max-w-xl` (576px): Invite form, small modals
- `max-w-2xl` (672px): Home page hero
- `max-w-4xl` (896px): Library, Settings, Events/new
- `max-w-5xl` (1024px): Event detail page
- `max-w-6xl` (1152px): Members, Events list

**Recommendation for Roster Table**:
Use **horizontal scroll** on mobile (table too wide to stack):

```svelte
<div class="container mx-auto max-w-full px-4 py-8">
  <div class="overflow-x-auto">
    <table class="min-w-full">
      <!-- Table with many columns -->
    </table>
  </div>
</div>
```

**Alternative**: Hide some event columns on mobile using `hidden md:table-cell`

```svelte
<th class="hidden md:table-cell">Event 3</th>
<td class="hidden md:table-cell">✓</td>
```

**Mobile UX Note**: Sticky first column (Name) remains visible while scrolling horizontally.

---

## 7. Data Loading & State Management Patterns

### Pattern: Server Load + Client State

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L7-L26)

```typescript
let { data }: { data: PageData } = $props();

// Local reactive copy for client-side updates
let members = $state(untrack(() => data.members));
let invites = $state(untrack(() => data.invites));

// Sync when server data changes (e.g., navigation)
$effect(() => {
  members = data.members;
  invites = data.invites;
});
```

**Key Points**:

1. `untrack()` captures initial value without creating reactivity
2. `$effect()` watches for server data changes
3. Local mutations trigger reactivity via reassignment
4. API calls update local state optimistically

**Recommendation for Roster Table**:
Same pattern—load attendance data via `+page.server.ts`, manage edits client-side.

---

## 8. Loading/Error States

### Loading State Pattern

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L14-L17)

```typescript
let updatingMember = $state<string | null>(null); // Track which item is loading
let removingMember = $state<string | null>(null);
```

```svelte
<button
  disabled={updatingMember === member.id}
  class="... disabled:opacity-50"
>
  {updatingMember === member.id ? 'Saving...' : 'Save'}
</button>
```

### Error State Pattern

- Location: [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte#L18, L45-L56)

```typescript
let error = $state("");

try {
  // API call
} catch (err) {
  error = err instanceof Error ? err.message : "Failed to ...";
  setTimeout(() => (error = ""), 5000); // Auto-clear after 5s
}
```

```svelte
{#if error}
  <div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
    {error}
  </div>
{/if}
```

**Recommendation**: Apply same patterns for attendance updates.

---

## Summary & Recommendations

### ✅ **Patterns to Reuse**

1. **Color-coded status indicators** → Use for attendance cells
2. **Filter buttons with active state** → Section/event filters
3. **Text search input** → Member name search
4. **Container max-width** → Use `max-w-full` for wide table
5. **Loading/error states** → Track saving state per cell
6. **Section abbreviations** → Use in column headers with tooltips
7. **Badge color palette** → Green (present), Red (absent), Amber (excused), Gray (unknown)

### 🆕 **Patterns That Don't Exist Yet (Need to Create)**

1. **`<table>` component** → First use of semantic tables
2. **Sticky positioning** → For header row and name column
3. **Horizontal scroll container** → Mobile responsiveness for wide tables
4. **Cell-level interactivity** → Click to toggle attendance status
5. **Inline editing in table cells** → Unlike cards which use dropdowns
6. **Date range filtering** → Too complex for MVP; use event dropdown instead
7. **Multi-column sorting** → Not needed for MVP

### 📐 **Recommended Table Structure**

```svelte
<div class="container mx-auto max-w-full px-4 py-8">
  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-3">
    <input type="text" bind:value={searchQuery} placeholder="Search members..." />
    <select bind:value={selectedEventId}>...</select>
    <button onclick={() => sectionFilter = 'all'}>All Sections</button>
  </div>

  <!-- Table container with horizontal scroll -->
  <div class="overflow-x-auto rounded-lg border border-gray-200">
    <table class="min-w-full bg-white">
      <!-- Sticky header -->
      <thead class="sticky top-0 bg-gray-50 z-10 border-b-2 border-gray-300">
        <tr>
          <!-- Sticky name column -->
          <th class="sticky left-0 bg-gray-50 z-20 px-4 py-3 text-left">Name</th>
          <th class="px-3 py-3" title="Soprano 1">S1</th>
          <th class="px-3 py-3" title="Event: Spring Concert">Mar 15</th>
          <!-- More event columns -->
        </tr>
      </thead>
      <tbody>
        {#each filteredMembers as member}
          <tr class="border-b hover:bg-gray-50">
            <!-- Sticky name cell -->
            <td class="sticky left-0 bg-white z-10 px-4 py-3 font-medium">
              {member.name}
            </td>
            <td class="px-3 py-3 text-xs text-gray-600">{member.primarySection?.abbreviation ?? '—'}</td>
            <td class="px-3 py-3 text-center">
              <button
                onclick={() => toggleAttendance(member.id, event.id)}
                class="px-2 py-1 rounded text-xs font-medium {getAttendanceColor(status)}"
              >
                {getAttendanceIcon(status)}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```

### 🎨 **Color Scheme for Attendance**

```typescript
function getAttendanceColor(
  status: "present" | "absent" | "excused" | null,
): string {
  switch (status) {
    case "present":
      return "bg-green-100 text-green-800 border border-green-300";
    case "absent":
      return "bg-red-100 text-red-800 border border-red-300";
    case "excused":
      return "bg-amber-100 text-amber-800 border border-amber-300";
    default:
      return "bg-gray-100 text-gray-500 border border-gray-300";
  }
}

function getAttendanceIcon(
  status: "present" | "absent" | "excused" | null,
): string {
  switch (status) {
    case "present":
      return "✓";
    case "absent":
      return "✗";
    case "excused":
      return "E";
    default:
      return "•";
  }
}
```

---

## Files Referenced

- [apps/vault/src/routes/events/+page.svelte](../apps/vault/src/routes/events/+page.svelte) - Event list with filters
- [apps/vault/src/routes/events/[id]/+page.svelte](../apps/vault/src/routes/events/[id]/+page.svelte) - Event detail with program management
- [apps/vault/src/routes/events/new/+page.svelte](../apps/vault/src/routes/events/new/+page.svelte) - Event creation form with date inputs
- [apps/vault/src/routes/members/+page.svelte](../apps/vault/src/routes/members/+page.svelte) - Member management with sections/voices
- [apps/vault/src/routes/library/+page.svelte](../apps/vault/src/routes/library/+page.svelte) - Score library with search
- [apps/vault/src/routes/invite/+page.svelte](../apps/vault/src/routes/invite/+page.svelte) - Invite form with multi-select
- [apps/vault/src/lib/types.ts](../apps/vault/src/lib/types.ts) - Type definitions (Role, Section, Voice)

---

_End of Research Report_
