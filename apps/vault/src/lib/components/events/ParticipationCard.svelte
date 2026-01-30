<script lang="ts">
  import { onMount } from "svelte";
  import Card from "$lib/components/Card.svelte";
  import type { PlannedStatus, ActualStatus } from "$lib/types";
  import { toast } from "$lib/stores/toast";

  interface Section {
    name: string;
    abbreviation: string;
    displayOrder?: number;
  }

  interface ParticipationMember {
    memberId: string;
    memberName: string;
    plannedStatus: PlannedStatus | null;
    actualStatus: ActualStatus | null;
    primarySection: Section | null;
  }

  interface MyParticipation {
    plannedStatus: PlannedStatus | null;
    actualStatus: ActualStatus | null;
  }

  interface Props {
    eventId: string;
    hasStarted: boolean;
    canRecordAttendance: boolean;
    myParticipation?: MyParticipation | null;
  }

  let {
    eventId,
    hasStarted,
    canRecordAttendance,
    myParticipation = $bindable(null),
  }: Props = $props();

  // State
  let participationData = $state<ParticipationMember[]>([]);
  let loadingParticipation = $state(false);
  let updatingRsvp = $state(false);
  let showParticipationDetails = $state(false);
  let recordingAttendance = $state<Record<string, boolean>>({});
  let bulkUpdatingAttendance = $state(false);

  // Load participation on mount
  onMount(() => {
    loadParticipation();
  });

  async function loadParticipation() {
    if (loadingParticipation) return;

    loadingParticipation = true;
    try {
      const response = await fetch(`/api/events/${eventId}/participation`);
      if (!response.ok) {
        throw new Error("Failed to load participation data");
      }
      participationData = await response.json();
    } catch (err) {
      console.error("Failed to load participation:", err);
    } finally {
      loadingParticipation = false;
    }
  }

  async function updateMyRsvp(status: PlannedStatus) {
    updatingRsvp = true;

    try {
      const response = await fetch(`/api/events/${eventId}/participation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to update RSVP");
      }

      // Update local state for immediate reactivity
      if (myParticipation) {
        myParticipation = { ...myParticipation, plannedStatus: status };
      } else {
        myParticipation = { plannedStatus: status, actualStatus: null };
      }

      // Reload full participation data in background
      await loadParticipation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update RSVP");
    } finally {
      updatingRsvp = false;
    }
  }

  async function updateAttendance(memberId: string, status: ActualStatus) {
    recordingAttendance[memberId] = true;

    try {
      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, status }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to record attendance");
      }

      await loadParticipation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance");
    } finally {
      recordingAttendance[memberId] = false;
    }
  }

  async function markAllPresent() {
    const confirmed = confirm("Mark all members as present?");
    if (!confirmed) return;

    bulkUpdatingAttendance = true;

    try {
      const updates = participationData.map((p) => ({
        memberId: p.memberId,
        status: "present" as ActualStatus,
      }));

      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to mark all present");
      }

      await loadParticipation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark all present");
    } finally {
      bulkUpdatingAttendance = false;
    }
  }

  // Calculate section summary
  function getSectionSummary(): string {
    if (participationData.length === 0) return "";

    const sectionCounts: Record<string, number> = {};
    let totalYes = 0;

    participationData.forEach((p) => {
      if (p.plannedStatus === "yes" && p.primarySection) {
        const abbr = p.primarySection.abbreviation;
        sectionCounts[abbr] = (sectionCounts[abbr] || 0) + 1;
        totalYes++;
      }
    });

    const sectionOrder = new Map<string, number>();
    participationData.forEach((p) => {
      if (p.primarySection) {
        sectionOrder.set(p.primarySection.abbreviation, p.primarySection.displayOrder ?? 999);
      }
    });

    const orderedSections = Object.entries(sectionCounts).sort(([a], [b]) => {
      const orderA = sectionOrder.get(a) ?? 999;
      const orderB = sectionOrder.get(b) ?? 999;
      return orderA - orderB;
    });

    if (orderedSections.length === 0) return "No RSVPs yet";

    const summary = orderedSections.map(([section, count]) => `${section}: ${count}`).join("  ");

    return `${summary}  (${totalYes} total)`;
  }

  // Group members by section
  function getMembersBySection() {
    const grouped: Record<string, ParticipationMember[]> = {};

    participationData.forEach((p) => {
      const sectionName = p.primarySection?.name || "No section";
      if (!grouped[sectionName]) {
        grouped[sectionName] = [];
      }
      grouped[sectionName].push(p);
    });

    return grouped;
  }
</script>

<Card padding="lg" class="mb-8">
  <h2 class="mb-4 text-2xl font-semibold">Participation</h2>

  <!-- My RSVP -->
  {#if !hasStarted}
    <div class="mb-6 rounded-lg bg-blue-50 p-4">
      <h3 class="mb-2 font-semibold text-blue-900">Your RSVP</h3>
      <div class="flex gap-2">
        <button
          onclick={() => updateMyRsvp("yes")}
          disabled={updatingRsvp}
          class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus ===
          'yes'
            ? 'bg-green-600 text-white border-green-700'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onclick={() => updateMyRsvp("no")}
          disabled={updatingRsvp}
          class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus ===
          'no'
            ? 'bg-red-600 text-white border-red-700'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
        >
          No
        </button>
        <button
          onclick={() => updateMyRsvp("maybe")}
          disabled={updatingRsvp}
          class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus ===
          'maybe'
            ? 'bg-yellow-600 text-white border-yellow-700'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
        >
          Maybe
        </button>
        <button
          onclick={() => updateMyRsvp("late")}
          disabled={updatingRsvp}
          class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus ===
          'late'
            ? 'bg-orange-600 text-white border-orange-700'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
        >
          Late
        </button>
      </div>
    </div>
  {:else}
    <div class="mb-6 rounded-lg bg-gray-100 p-4">
      <p class="text-sm text-gray-600">
        {#if myParticipation?.plannedStatus}
          Your RSVP: <span class="font-medium capitalize">{myParticipation.plannedStatus}</span> (locked
          - event has started)
        {:else}
          RSVP is locked (event has started)
        {/if}
      </p>
    </div>
  {/if}

  <!-- Section Summary -->
  <div class="mb-4">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">RSVPs by Section</h3>
      <button
        onclick={() => (showParticipationDetails = !showParticipationDetails)}
        class="text-sm text-blue-600 hover:text-blue-800"
      >
        {showParticipationDetails ? "Hide details" : "Show details"}
      </button>
    </div>
    <p class="mt-2 text-sm text-gray-600">
      {loadingParticipation ? "Loading..." : getSectionSummary()}
    </p>
  </div>

  <!-- Detailed Participation List -->
  {#if showParticipationDetails}
    <div class="mt-4 space-y-4">
      {#each Object.entries(getMembersBySection()) as [sectionName, members]}
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 class="mb-3 font-semibold text-gray-900">{sectionName}</h4>
          <div class="space-y-2">
            {#each members as member}
              <div class="flex items-center justify-between text-sm">
                <div class="flex-1">
                  <span class="font-medium">{member.memberName}</span>
                  {#if member.plannedStatus}
                    <span
                      class="ml-2 rounded-full px-2 py-0.5 text-xs {member.plannedStatus === 'yes'
                        ? 'bg-green-100 text-green-800'
                        : member.plannedStatus === 'no'
                          ? 'bg-red-100 text-red-800'
                          : member.plannedStatus === 'maybe'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-orange-100 text-orange-800'}"
                    >
                      {member.plannedStatus}
                    </span>
                  {:else}
                    <span class="ml-2 text-gray-500">No response</span>
                  {/if}
                </div>
                {#if member.actualStatus}
                  <span class="text-xs text-gray-500">
                    Attended: {member.actualStatus}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Attendance Recording (Conductor only, after event starts) -->
  {#if hasStarted && canRecordAttendance}
    <div class="mt-6 border-t border-gray-200 pt-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-semibold">Record Attendance</h3>
        <button
          onclick={markAllPresent}
          disabled={bulkUpdatingAttendance}
          class="rounded-lg bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {bulkUpdatingAttendance ? "Updating..." : "Mark All Present"}
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium text-gray-700"> Member </th>
              <th class="px-4 py-2 text-left text-sm font-medium text-gray-700"> Section </th>
              <th class="px-4 py-2 text-left text-sm font-medium text-gray-700"> RSVP </th>
              <th class="px-4 py-2 text-left text-sm font-medium text-gray-700"> Attendance </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each participationData as member}
              <tr>
                <td class="px-4 py-2 text-sm">{member.memberName}</td>
                <td class="px-4 py-2 text-sm">
                  {member.primarySection?.abbreviation || "-"}
                </td>
                <td class="px-4 py-2 text-sm">
                  {#if member.plannedStatus}
                    <span class="capitalize">{member.plannedStatus}</span>
                  {:else}
                    <span class="text-gray-400">No response</span>
                  {/if}
                </td>
                <td class="px-4 py-2">
                  <div class="flex gap-1">
                    <button
                      onclick={() => updateAttendance(member.memberId, "present")}
                      disabled={recordingAttendance[member.memberId]}
                      class="rounded border px-2 py-1 text-xs transition {member.actualStatus ===
                      'present'
                        ? 'bg-green-600 text-white border-green-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
                    >
                      Present
                    </button>
                    <button
                      onclick={() => updateAttendance(member.memberId, "absent")}
                      disabled={recordingAttendance[member.memberId]}
                      class="rounded border px-2 py-1 text-xs transition {member.actualStatus ===
                      'absent'
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
                    >
                      Absent
                    </button>
                    <button
                      onclick={() => updateAttendance(member.memberId, "late")}
                      disabled={recordingAttendance[member.memberId]}
                      class="rounded border px-2 py-1 text-xs transition {member.actualStatus ===
                      'late'
                        ? 'bg-orange-600 text-white border-orange-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
                    >
                      Late
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</Card>
