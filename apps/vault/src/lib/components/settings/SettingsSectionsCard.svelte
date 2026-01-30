<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import { toast } from "$lib/stores/toast";
  import type { SectionWithCount } from "$lib/server/db/sections";

  interface Props {
    sections: SectionWithCount[];
  }

  let { sections = $bindable() }: Props = $props();

  // State
  let togglingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let reassigningId = $state<string | null>(null);
  let creatingSection = $state(false);
  let rearrangingSections = $state(false);
  let savingOrder = $state(false);
  let openReassignDropdown = $state<string | null>(null);

  // Form state
  let newSectionName = $state("");
  let newSectionAbbr = $state("");

  // Original order for cancel
  let originalSections: SectionWithCount[] = [];

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".reassign-dropdown")) {
      openReassignDropdown = null;
    }
  }

  async function toggleSection(section: SectionWithCount) {
    togglingId = section.id;

    try {
      const response = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !section.isActive }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update section");
      }

      sections = sections.map((s) =>
        s.id === section.id ? { ...s, isActive: !s.isActive } : s
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update section");
    } finally {
      togglingId = null;
    }
  }

  async function deleteSection(section: SectionWithCount) {
    if (section.assignmentCount > 0) return;

    if (!confirm(`Delete "${section.name}"? This cannot be undone.`)) return;

    deletingId = section.id;

    try {
      const response = await fetch(`/api/sections/${section.id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete section");
      }

      sections = sections.filter((s) => s.id !== section.id);
      toast.success(`Deleted "${section.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete section");
    } finally {
      deletingId = null;
    }
  }

  async function reassignSection(sourceId: string, targetId: string) {
    openReassignDropdown = null;
    reassigningId = sourceId;

    try {
      const response = await fetch(`/api/sections/${sourceId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSectionId: targetId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to reassign section");
      }

      const result = (await response.json()) as {
        movedCount: number;
        sourceSection: string;
        targetSection: string;
      };

      sections = sections.map((s) => {
        if (s.id === sourceId) return { ...s, assignmentCount: 0 };
        if (s.id === targetId) {
          const sourceSection = sections.find((x) => x.id === sourceId);
          return {
            ...s,
            assignmentCount: s.assignmentCount + (sourceSection?.assignmentCount ?? 0),
          };
        }
        return s;
      });

      toast.success(
        `Moved ${result.movedCount} assignment(s) from ${result.sourceSection} to ${result.targetSection}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign section");
    } finally {
      reassigningId = null;
    }
  }

  async function createSection(e: Event) {
    e.preventDefault();
    if (!newSectionName.trim() || !newSectionAbbr.trim()) return;

    creatingSection = true;

    try {
      const response = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSectionName.trim(),
          abbreviation: newSectionAbbr.trim(),
          displayOrder: sections.length,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create section");
      }

      const newSection = (await response.json()) as SectionWithCount;
      sections = [...sections, { ...newSection, assignmentCount: 0 }];

      newSectionName = "";
      newSectionAbbr = "";

      toast.success(`Created "${newSection.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create section");
    } finally {
      creatingSection = false;
    }
  }

  function startRearrange() {
    originalSections = [...sections];
    rearrangingSections = true;
  }

  function moveSectionUp(index: number) {
    if (index <= 0) return;
    const newSections = [...sections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    sections = newSections;
  }

  function moveSectionDown(index: number) {
    if (index >= sections.length - 1) return;
    const newSections = [...sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    sections = newSections;
  }

  async function saveOrder() {
    savingOrder = true;

    try {
      const response = await fetch("/api/sections/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionIds: sections.map((s) => s.id) }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save section order");
      }

      const updatedSections = (await response.json()) as SectionWithCount[];
      sections = updatedSections;

      rearrangingSections = false;
      toast.success("Section order saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save section order");
    } finally {
      savingOrder = false;
    }
  }

  function cancelRearrange() {
    sections = originalSections;
    rearrangingSections = false;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<Card padding="lg" class="mt-8">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold">Performance Sections</h2>
    {#if !rearrangingSections}
      <button
        onclick={startRearrange}
        class="rounded-md border border-teal-600 px-3 py-1 text-sm text-teal-600 transition hover:bg-teal-50"
      >
        Rearrange
      </button>
    {/if}
  </div>

  {#if rearrangingSections}
    <!-- Rearrange Mode -->
    <p class="mb-4 text-sm text-gray-600">Use the arrows to reorder sections. Click Save when done.</p>

    <div class="max-w-md space-y-2">
      {#each sections as section, index (section.id)}
        <div
          class="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2"
        >
          <span class="flex-1 font-medium">{section.name}</span>
          <span class="text-xs text-gray-500">({section.abbreviation})</span>
          <div class="flex gap-1">
            <button
              onclick={() => moveSectionUp(index)}
              disabled={index === 0 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onclick={() => moveSectionDown(index)}
              disabled={index === sections.length - 1 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </div>
        </div>
      {/each}
    </div>

    <div class="mt-4 flex gap-2">
      <button
        onclick={saveOrder}
        disabled={savingOrder}
        class="rounded-md bg-teal-600 px-4 py-2 text-sm text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        {savingOrder ? "Saving..." : "Save Order"}
      </button>
      <button
        onclick={cancelRearrange}
        disabled={savingOrder}
        class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  {:else}
    <!-- Normal Mode -->
    <p class="mb-4 text-sm text-gray-600">
      Manage sections for performance assignments. Click left side to toggle active status, right
      side to delete or reassign.
    </p>

    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each sections as section (section.id)}
        {@const isProcessing =
          togglingId === section.id || deletingId === section.id || reassigningId === section.id}
        <div
          class="flex items-center rounded-lg border {section.isActive
            ? 'border-teal-200 bg-teal-50'
            : 'border-gray-200 bg-gray-50'}"
        >
          <!-- Left side: Toggle active -->
          <button
            onclick={() => toggleSection(section)}
            disabled={isProcessing}
            class="flex flex-1 items-center justify-between rounded-l-lg px-3 py-2 text-left transition hover:bg-teal-100 disabled:opacity-50"
          >
            <div class="flex min-w-0 items-center gap-1">
              <span class="truncate font-medium {section.isActive ? '' : 'text-gray-500'}"
                >{section.name}</span
              >
              <span class="shrink-0 text-xs text-gray-500">({section.abbreviation})</span>
            </div>
            <span class="text-lg" title={section.isActive ? "Active" : "Inactive"}>
              {#if togglingId === section.id}
                <span class="text-gray-400">⏳</span>
              {:else if section.isActive}
                <span class="text-green-600">🟢</span>
              {:else}
                <span class="text-gray-400">⚪</span>
              {/if}
            </span>
          </button>

          <!-- Right side: Delete or Reassign -->
          <div class="reassign-dropdown relative border-l border-gray-200">
            {#if section.assignmentCount === 0}
              <!-- No assignments: show delete button -->
              <button
                onclick={() => deleteSection(section)}
                disabled={isProcessing}
                class="rounded-r-lg px-2 py-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete (no assignments)"
              >
                {#if deletingId === section.id}
                  ⏳
                {:else}
                  🗑️
                {/if}
              </button>
            {:else}
              <!-- Has assignments: show reassign dropdown -->
              <button
                onclick={() =>
                  (openReassignDropdown =
                    openReassignDropdown === section.id ? null : section.id)}
                disabled={isProcessing}
                class="flex items-center gap-0.5 rounded-r-lg px-2 py-2 text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                title="Reassign {section.assignmentCount} member(s)"
              >
                {#if reassigningId === section.id}
                  ⏳
                {:else}
                  <span>↔️</span>
                  <span class="text-sm font-medium">{section.assignmentCount}</span>
                  <span class="text-xs">▼</span>
                {/if}
              </button>

              {#if openReassignDropdown === section.id}
                <div
                  class="absolute right-0 top-full z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                >
                  <div class="py-1">
                    <div class="border-b px-3 py-2 text-xs text-gray-500">Reassign to:</div>
                    {#each sections.filter((s) => s.id !== section.id) as targetSection}
                      <button
                        onclick={() => reassignSection(section.id, targetSection.id)}
                        class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {targetSection.name} ({targetSection.abbreviation})
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create new section form -->
  <form onsubmit={createSection} class="mt-4 border-t pt-4">
    <h3 class="mb-2 text-sm font-medium text-gray-700">Add New Section</h3>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newSectionName}
        placeholder="Name (e.g., Soprano 3)"
        class="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        required
      />
      <input
        type="text"
        bind:value={newSectionAbbr}
        placeholder="Abbr (e.g., S3)"
        class="w-24 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        maxlength="5"
        required
      />
      <button
        type="submit"
        disabled={creatingSection || !newSectionName.trim() || !newSectionAbbr.trim()}
        class="rounded-md bg-teal-600 px-4 py-2 text-sm text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creatingSection ? "..." : "Add"}
      </button>
    </div>
  </form>
</Card>
