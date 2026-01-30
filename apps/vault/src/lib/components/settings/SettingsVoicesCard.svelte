<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import { toast } from "$lib/stores/toast";
  import type { VoiceWithCount } from "$lib/server/db/voices";

  interface Props {
    voices: VoiceWithCount[];
  }

  let { voices = $bindable() }: Props = $props();

  // State
  let togglingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let reassigningId = $state<string | null>(null);
  let creatingVoice = $state(false);
  let rearrangingVoices = $state(false);
  let savingOrder = $state(false);
  let openReassignDropdown = $state<string | null>(null);

  // Form state
  let newVoiceName = $state("");
  let newVoiceAbbr = $state("");
  let newVoiceCategory = $state<"vocal" | "instrumental">("vocal");

  // Original order for cancel
  let originalVoices: VoiceWithCount[] = [];

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".reassign-dropdown")) {
      openReassignDropdown = null;
    }
  }

  async function toggleVoice(voice: VoiceWithCount) {
    togglingId = voice.id;

    try {
      const response = await fetch(`/api/voices/${voice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !voice.isActive }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update voice");
      }

      voices = voices.map((v) => (v.id === voice.id ? { ...v, isActive: !v.isActive } : v));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update voice");
    } finally {
      togglingId = null;
    }
  }

  async function deleteVoice(voice: VoiceWithCount) {
    if (voice.assignmentCount > 0) return;

    if (!confirm(`Delete "${voice.name}"? This cannot be undone.`)) return;

    deletingId = voice.id;

    try {
      const response = await fetch(`/api/voices/${voice.id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete voice");
      }

      voices = voices.filter((v) => v.id !== voice.id);
      toast.success(`Deleted "${voice.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete voice");
    } finally {
      deletingId = null;
    }
  }

  async function reassignVoice(sourceId: string, targetId: string) {
    openReassignDropdown = null;
    reassigningId = sourceId;

    try {
      const response = await fetch(`/api/voices/${sourceId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetVoiceId: targetId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to reassign voice");
      }

      const result = (await response.json()) as {
        movedCount: number;
        sourceVoice: string;
        targetVoice: string;
      };

      voices = voices.map((v) => {
        if (v.id === sourceId) return { ...v, assignmentCount: 0 };
        if (v.id === targetId) {
          const sourceVoice = voices.find((x) => x.id === sourceId);
          return { ...v, assignmentCount: v.assignmentCount + (sourceVoice?.assignmentCount ?? 0) };
        }
        return v;
      });

      toast.success(
        `Moved ${result.movedCount} assignment(s) from ${result.sourceVoice} to ${result.targetVoice}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign voice");
    } finally {
      reassigningId = null;
    }
  }

  async function createVoice(e: Event) {
    e.preventDefault();
    if (!newVoiceName.trim() || !newVoiceAbbr.trim()) return;

    creatingVoice = true;

    try {
      const response = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVoiceName.trim(),
          abbreviation: newVoiceAbbr.trim(),
          category: newVoiceCategory,
          displayOrder: voices.length,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create voice");
      }

      const newVoice = (await response.json()) as VoiceWithCount;
      voices = [...voices, { ...newVoice, assignmentCount: 0 }];

      newVoiceName = "";
      newVoiceAbbr = "";
      newVoiceCategory = "vocal";

      toast.success(`Created "${newVoice.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create voice");
    } finally {
      creatingVoice = false;
    }
  }

  function startRearrange() {
    originalVoices = [...voices];
    rearrangingVoices = true;
  }

  function moveVoiceUp(index: number) {
    if (index <= 0) return;
    const newVoices = [...voices];
    [newVoices[index - 1], newVoices[index]] = [newVoices[index], newVoices[index - 1]];
    voices = newVoices;
  }

  function moveVoiceDown(index: number) {
    if (index >= voices.length - 1) return;
    const newVoices = [...voices];
    [newVoices[index], newVoices[index + 1]] = [newVoices[index + 1], newVoices[index]];
    voices = newVoices;
  }

  async function saveOrder() {
    savingOrder = true;

    try {
      const response = await fetch("/api/voices/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceIds: voices.map((v) => v.id) }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save voice order");
      }

      const updatedVoices = (await response.json()) as VoiceWithCount[];
      voices = updatedVoices;

      rearrangingVoices = false;
      toast.success("Voice order saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save voice order");
    } finally {
      savingOrder = false;
    }
  }

  function cancelRearrange() {
    voices = originalVoices;
    rearrangingVoices = false;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<Card padding="lg" class="mt-8">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold">Vocal Ranges</h2>
    {#if !rearrangingVoices}
      <button
        onclick={startRearrange}
        class="rounded-md border border-purple-600 px-3 py-1 text-sm text-purple-600 transition hover:bg-purple-50"
      >
        Rearrange
      </button>
    {/if}
  </div>

  {#if rearrangingVoices}
    <!-- Rearrange Mode -->
    <p class="mb-4 text-sm text-gray-600">
      Use the arrows to reorder vocal ranges. Click Save when done.
    </p>

    <div class="max-w-md space-y-2">
      {#each voices as voice, index (voice.id)}
        <div
          class="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2"
        >
          <span class="flex-1 font-medium">{voice.name}</span>
          <span class="text-xs text-gray-500">({voice.abbreviation})</span>
          {#if voice.category === "instrumental"}
            <span class="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">instr</span>
          {/if}
          <div class="flex gap-1">
            <button
              onclick={() => moveVoiceUp(index)}
              disabled={index === 0 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onclick={() => moveVoiceDown(index)}
              disabled={index === voices.length - 1 || savingOrder}
              class="rounded px-2 py-1 text-sm font-bold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-30"
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
        class="rounded-md bg-purple-600 px-4 py-2 text-sm text-white transition hover:bg-purple-700 disabled:opacity-50"
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
      Manage vocal ranges for member assignment. Click left side to toggle active status, right side
      to delete or reassign.
    </p>

    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each voices as voice (voice.id)}
        {@const isProcessing =
          togglingId === voice.id || deletingId === voice.id || reassigningId === voice.id}
        <div
          class="flex items-center rounded-lg border {voice.isActive
            ? 'border-purple-200 bg-purple-50'
            : 'border-gray-200 bg-gray-50'}"
        >
          <!-- Left side: Toggle active -->
          <button
            onclick={() => toggleVoice(voice)}
            disabled={isProcessing}
            class="flex flex-1 items-center justify-between rounded-l-lg px-3 py-2 text-left transition hover:bg-purple-100 disabled:opacity-50"
          >
            <div class="flex min-w-0 items-center gap-1">
              <span class="truncate font-medium {voice.isActive ? '' : 'text-gray-500'}"
                >{voice.name}</span
              >
              <span class="shrink-0 text-xs text-gray-500">({voice.abbreviation})</span>
              {#if voice.category === "instrumental"}
                <span class="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">instr</span>
              {/if}
            </div>
            <span class="text-lg" title={voice.isActive ? "Active" : "Inactive"}>
              {#if togglingId === voice.id}
                <span class="text-gray-400">⏳</span>
              {:else if voice.isActive}
                <span class="text-green-600">🟢</span>
              {:else}
                <span class="text-gray-400">⚪</span>
              {/if}
            </span>
          </button>

          <!-- Right side: Delete or Reassign -->
          <div class="reassign-dropdown relative border-l border-gray-200">
            {#if voice.assignmentCount === 0}
              <!-- No assignments: show delete button -->
              <button
                onclick={() => deleteVoice(voice)}
                disabled={isProcessing}
                class="rounded-r-lg px-2 py-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete (no assignments)"
              >
                {#if deletingId === voice.id}
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
                    openReassignDropdown === voice.id ? null : voice.id)}
                disabled={isProcessing}
                class="flex items-center gap-0.5 rounded-r-lg px-2 py-2 text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                title="Reassign {voice.assignmentCount} member(s)"
              >
                {#if reassigningId === voice.id}
                  ⏳
                {:else}
                  <span>↔️</span>
                  <span class="text-sm font-medium">{voice.assignmentCount}</span>
                  <span class="text-xs">▼</span>
                {/if}
              </button>

              {#if openReassignDropdown === voice.id}
                <div
                  class="absolute right-0 top-full z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                >
                  <div class="py-1">
                    <div class="border-b px-3 py-2 text-xs text-gray-500">Reassign to:</div>
                    {#each voices.filter((v) => v.id !== voice.id) as targetVoice}
                      <button
                        onclick={() => reassignVoice(voice.id, targetVoice.id)}
                        class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {targetVoice.name} ({targetVoice.abbreviation})
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

  <!-- Create new voice form -->
  <form onsubmit={createVoice} class="mt-4 border-t pt-4">
    <h3 class="mb-2 text-sm font-medium text-gray-700">Add New Vocal Range</h3>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newVoiceName}
        placeholder="Name (e.g., Mezzo-Soprano)"
        class="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        required
      />
      <input
        type="text"
        bind:value={newVoiceAbbr}
        placeholder="Abbr (e.g., MS)"
        class="w-24 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        maxlength="5"
        required
      />
      <select
        bind:value={newVoiceCategory}
        class="rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      >
        <option value="vocal">Vocal</option>
        <option value="instrumental">Instrumental</option>
      </select>
      <button
        type="submit"
        disabled={creatingVoice || !newVoiceName.trim() || !newVoiceAbbr.trim()}
        class="rounded-md bg-purple-600 px-4 py-2 text-sm text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creatingVoice ? "..." : "Add"}
      </button>
    </div>
  </form>
</Card>
