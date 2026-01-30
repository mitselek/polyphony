<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import { toast } from "$lib/stores/toast";

  // Generic entity with common properties
  interface EntityWithCount {
    id: string;
    name: string;
    abbreviation: string;
    isActive: boolean;
    assignmentCount: number;
    category?: "vocal" | "instrumental"; // Only for voices
  }

  type EntityType = "voice" | "section";

  interface Props {
    type: EntityType;
    items: EntityWithCount[];
  }

  let { type, items = $bindable() }: Props = $props();

  // Derived config based on type
  let config = $derived({
    voice: {
      singular: "voice",
      plural: "voices",
      title: "Vocal Ranges",
      description: "Manage vocal ranges for member assignment.",
      rearrangeDescription: "Use the arrows to reorder vocal ranges. Click Save when done.",
      addTitle: "Add New Vocal Range",
      placeholder: "Name (e.g., Mezzo-Soprano)",
      abbrPlaceholder: "Abbr (e.g., MS)",
      apiPath: "/api/voices",
      targetIdKey: "targetVoiceId",
      reorderKey: "voiceIds",
      color: {
        border: "border-purple-600",
        bg: "bg-purple-600",
        bgHover: "hover:bg-purple-700",
        bgLight: "bg-purple-50",
        bgLightHover: "hover:bg-purple-100",
        borderLight: "border-purple-200",
        text: "text-purple-600",
        textDark: "text-purple-700",
        focusBorder: "focus:border-purple-500",
        focusRing: "focus:ring-purple-500",
      },
      hasCategory: true,
    },
    section: {
      singular: "section",
      plural: "sections",
      title: "Performance Sections",
      description: "Manage sections for performance assignments.",
      rearrangeDescription: "Use the arrows to reorder sections. Click Save when done.",
      addTitle: "Add New Section",
      placeholder: "Name (e.g., Soprano 3)",
      abbrPlaceholder: "Abbr (e.g., S3)",
      apiPath: "/api/sections",
      targetIdKey: "targetSectionId",
      reorderKey: "sectionIds",
      color: {
        border: "border-teal-600",
        bg: "bg-teal-600",
        bgHover: "hover:bg-teal-700",
        bgLight: "bg-teal-50",
        bgLightHover: "hover:bg-teal-100",
        borderLight: "border-teal-200",
        text: "text-teal-600",
        textDark: "text-teal-700",
        focusBorder: "focus:border-teal-500",
        focusRing: "focus:ring-teal-500",
      },
      hasCategory: false,
    },
  }[type]);

  // State
  let togglingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let reassigningId = $state<string | null>(null);
  let creating = $state(false);
  let rearranging = $state(false);
  let savingOrder = $state(false);
  let openReassignDropdown = $state<string | null>(null);

  // Form state
  let newName = $state("");
  let newAbbr = $state("");
  let newCategory = $state<"vocal" | "instrumental">("vocal");

  // Original order for cancel
  let originalItems: EntityWithCount[] = [];

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".reassign-dropdown")) {
      openReassignDropdown = null;
    }
  }

  async function toggleItem(item: EntityWithCount) {
    togglingId = item.id;

    try {
      const response = await fetch(`${config.apiPath}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to update ${config.singular}`);
      }

      items = items.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to update ${config.singular}`);
    } finally {
      togglingId = null;
    }
  }

  async function deleteItem(item: EntityWithCount) {
    if (item.assignmentCount > 0) return;

    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    deletingId = item.id;

    try {
      const response = await fetch(`${config.apiPath}/${item.id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to delete ${config.singular}`);
      }

      items = items.filter((i) => i.id !== item.id);
      toast.success(`Deleted "${item.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to delete ${config.singular}`);
    } finally {
      deletingId = null;
    }
  }

  async function reassignItem(sourceId: string, targetId: string) {
    openReassignDropdown = null;
    reassigningId = sourceId;

    try {
      const response = await fetch(`${config.apiPath}/${sourceId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [config.targetIdKey]: targetId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to reassign ${config.singular}`);
      }

      const result = (await response.json()) as {
        movedCount: number;
        [key: string]: string | number;
      };

      items = items.map((i) => {
        if (i.id === sourceId) return { ...i, assignmentCount: 0 };
        if (i.id === targetId) {
          const sourceItem = items.find((x) => x.id === sourceId);
          return { ...i, assignmentCount: i.assignmentCount + (sourceItem?.assignmentCount ?? 0) };
        }
        return i;
      });

      // Extract source and target names from result
      const sourceKey = type === "voice" ? "sourceVoice" : "sourceSection";
      const targetKey = type === "voice" ? "targetVoice" : "targetSection";
      toast.success(
        `Moved ${result.movedCount} assignment(s) from ${result[sourceKey]} to ${result[targetKey]}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to reassign ${config.singular}`);
    } finally {
      reassigningId = null;
    }
  }

  async function createItem(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !newAbbr.trim()) return;

    creating = true;

    try {
      const body: Record<string, string | number> = {
        name: newName.trim(),
        abbreviation: newAbbr.trim(),
        displayOrder: items.length,
      };

      if (config.hasCategory) {
        body.category = newCategory;
      }

      const response = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to create ${config.singular}`);
      }

      const newItem = (await response.json()) as EntityWithCount;
      items = [...items, { ...newItem, assignmentCount: 0 }];

      newName = "";
      newAbbr = "";
      newCategory = "vocal";

      toast.success(`Created "${newItem.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to create ${config.singular}`);
    } finally {
      creating = false;
    }
  }

  function startRearrange() {
    originalItems = [...items];
    rearranging = true;
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    items = newItems;
  }

  function moveDown(index: number) {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    items = newItems;
  }

  async function saveOrder() {
    savingOrder = true;

    try {
      const response = await fetch(`${config.apiPath}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [config.reorderKey]: items.map((i) => i.id) }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to save ${config.singular} order`);
      }

      const updatedItems = (await response.json()) as EntityWithCount[];
      items = updatedItems;

      rearranging = false;
      toast.success(`${config.title.split(" ")[0]} order saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to save ${config.singular} order`);
    } finally {
      savingOrder = false;
    }
  }

  function cancelRearrange() {
    items = originalItems;
    rearranging = false;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<Card padding="lg" class="mt-8">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold">{config.title}</h2>
    {#if !rearranging}
      <button
        onclick={startRearrange}
        class="rounded-md border {config.color.border} px-3 py-1 text-sm {config.color.text} transition hover:{config.color.bgLight}"
      >
        Rearrange
      </button>
    {/if}
  </div>

  {#if rearranging}
    <!-- Rearrange Mode -->
    <p class="mb-4 text-sm text-gray-600">{config.rearrangeDescription}</p>

    <div class="max-w-md space-y-2">
      {#each items as item, index (item.id)}
        <div
          class="flex items-center gap-2 rounded-lg border {config.color.borderLight} {config.color.bgLight} px-3 py-2"
        >
          <span class="flex-1 font-medium">{item.name}</span>
          <span class="text-xs text-gray-500">({item.abbreviation})</span>
          {#if config.hasCategory && item.category === "instrumental"}
            <span class="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">instr</span>
          {/if}
          <div class="flex gap-1">
            <button
              onclick={() => moveUp(index)}
              disabled={index === 0 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold {config.color.textDark} {config.color.bgLightHover} disabled:cursor-not-allowed disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onclick={() => moveDown(index)}
              disabled={index === items.length - 1 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold {config.color.textDark} {config.color.bgLightHover} disabled:cursor-not-allowed disabled:opacity-30"
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
        class="rounded-md {config.color.bg} px-4 py-2 text-sm text-white transition {config.color.bgHover} disabled:opacity-50"
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
      {config.description} Click left side to toggle active status, right side to delete or reassign.
    </p>

    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each items as item (item.id)}
        {@const isProcessing =
          togglingId === item.id || deletingId === item.id || reassigningId === item.id}
        <div
          class="flex items-center rounded-lg border {item.isActive
            ? `${config.color.borderLight} ${config.color.bgLight}`
            : 'border-gray-200 bg-gray-50'}"
        >
          <!-- Left side: Toggle active -->
          <button
            onclick={() => toggleItem(item)}
            disabled={isProcessing}
            class="flex flex-1 items-center justify-between rounded-l-lg px-3 py-2 text-left transition {config.color.bgLightHover} disabled:opacity-50"
          >
            <div class="flex min-w-0 items-center gap-1">
              <span class="truncate font-medium {item.isActive ? '' : 'text-gray-500'}"
                >{item.name}</span
              >
              <span class="shrink-0 text-xs text-gray-500">({item.abbreviation})</span>
              {#if config.hasCategory && item.category === "instrumental"}
                <span class="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">instr</span>
              {/if}
            </div>
            <span class="text-lg" title={item.isActive ? "Active" : "Inactive"}>
              {#if togglingId === item.id}
                <span class="text-gray-400">⏳</span>
              {:else if item.isActive}
                <span class="text-green-600">🟢</span>
              {:else}
                <span class="text-gray-400">⚪</span>
              {/if}
            </span>
          </button>

          <!-- Right side: Delete or Reassign -->
          <div class="reassign-dropdown relative border-l border-gray-200">
            {#if item.assignmentCount === 0}
              <!-- No assignments: show delete button -->
              <button
                onclick={() => deleteItem(item)}
                disabled={isProcessing}
                class="rounded-r-lg px-2 py-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete (no assignments)"
              >
                {#if deletingId === item.id}
                  ⏳
                {:else}
                  🗑️
                {/if}
              </button>
            {:else}
              <!-- Has assignments: show reassign dropdown -->
              <button
                onclick={() =>
                  (openReassignDropdown = openReassignDropdown === item.id ? null : item.id)}
                disabled={isProcessing}
                class="flex items-center gap-0.5 rounded-r-lg px-2 py-2 text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                title="Reassign {item.assignmentCount} member(s)"
              >
                {#if reassigningId === item.id}
                  ⏳
                {:else}
                  <span>↔️</span>
                  <span class="text-sm font-medium">{item.assignmentCount}</span>
                  <span class="text-xs">▼</span>
                {/if}
              </button>

              {#if openReassignDropdown === item.id}
                <div
                  class="absolute right-0 top-full z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                >
                  <div class="py-1">
                    <div class="border-b px-3 py-2 text-xs text-gray-500">Reassign to:</div>
                    {#each items.filter((i) => i.id !== item.id) as targetItem}
                      <button
                        onclick={() => reassignItem(item.id, targetItem.id)}
                        class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {targetItem.name} ({targetItem.abbreviation})
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

  <!-- Create new item form -->
  <form onsubmit={createItem} class="mt-4 border-t pt-4">
    <h3 class="mb-2 text-sm font-medium text-gray-700">{config.addTitle}</h3>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newName}
        placeholder={config.placeholder}
        class="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm {config.color.focusBorder} focus:outline-none focus:ring-1 {config.color.focusRing}"
        required
      />
      <input
        type="text"
        bind:value={newAbbr}
        placeholder={config.abbrPlaceholder}
        class="w-24 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm {config.color.focusBorder} focus:outline-none focus:ring-1 {config.color.focusRing}"
        maxlength="5"
        required
      />
      {#if config.hasCategory}
        <select
          bind:value={newCategory}
          class="rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm {config.color.focusBorder} focus:outline-none focus:ring-1 {config.color.focusRing}"
        >
          <option value="vocal">Vocal</option>
          <option value="instrumental">Instrumental</option>
        </select>
      {/if}
      <button
        type="submit"
        disabled={creating || !newName.trim() || !newAbbr.trim()}
        class="rounded-md {config.color.bg} px-4 py-2 text-sm text-white transition {config.color.bgHover} disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? "..." : "Add"}
      </button>
    </div>
  </form>
</Card>
