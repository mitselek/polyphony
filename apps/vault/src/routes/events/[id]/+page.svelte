<script lang="ts">
  import { goto } from "$app/navigation";
  import { untrack, onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { PlannedStatus, ActualStatus } from "$lib/types";

  let { data }: { data: PageData } = $props();

  // Local state for program editor - use untrack for initial values
  let program = $state(untrack(() => [...data.program]));
  let availableScores = $state(
    untrack(() =>
      data.allScores.filter(
        (s: any) => !program.some((p) => p.score_id === s.id),
      ),
    ),
  );
  let selectedScoreId = $state("");
  let addingScore = $state(false);
  let removingScoreId = $state<string | null>(null);
  let reorderingProgram = $state(false);
  let error = $state("");
  
  // Derived state for button enablement
  let canAddScore = $derived(!!selectedScoreId && !addingScore);
  let editingEventId = $state<string | null>(null);
  
  // Helper: Parse starts_at to date and time components
  function parseDateTime(isoString: string): { date: string; time: string } {
    const dt = new Date(isoString);
    const date = dt.toISOString().split("T")[0];
    const time = dt.toTimeString().slice(0, 5);
    return { date, time };
  }

  // Helper: Calculate duration in minutes from start and end
  function calculateDuration(startIso: string, endIso: string | null): number {
    if (!endIso) return 120; // Default 2 hours
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    return Math.round((endMs - startMs) / (1000 * 60));
  }

  // Helper: Calculate end datetime from start + duration
  function calculateEndDateTime(startDate: string, startTime: string, durationMinutes: number): string {
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
    return endDateTime.toISOString();
  }

  // Helper: Format end time with +1 day indicator
  function formatEndTime(startDate: string, startTime: string, durationMinutes: number): { time: string; nextDay: boolean } {
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
    
    const time = endDateTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const nextDay = endDateTime.getDate() !== startDateTime.getDate();
    
    return { time, nextDay };
  }

  // Initialize edit form with datetime fields
  const initialDateTime = parseDateTime(data.event.starts_at);
  const initialDuration = calculateDuration(data.event.starts_at, data.event.ends_at);
  
  let editForm = $state(
    untrack(() => ({
      title: data.event.title,
      description: data.event.description || "",
      location: data.event.location || "",
      event_type: data.event.event_type,
      date: initialDateTime.date,
      time: initialDateTime.time,
      duration: initialDuration,
    })),
  );
  
  // Derived end time display for edit form
  let editEndTimeDisplay = $derived(
    editForm.date && editForm.time
      ? formatEndTime(editForm.date, editForm.time, editForm.duration)
      : { time: "", nextDay: false }
  );
  let updatingEvent = $state(false);
  let deletingEvent = $state(false);

  // Participation state
  let participationData = $state<any[]>([]);
  let loadingParticipation = $state(false);
  let updatingRsvp = $state(false);
  let showParticipationDetails = $state(false);
  let recordingAttendance = $state<Record<string, boolean>>({});
  let bulkUpdatingAttendance = $state(false);
  
  // Local state for myParticipation for reactive RSVP updates
  let myParticipation = $state<typeof data.myParticipation>(untrack(() => data.myParticipation));

  // Load participation data on mount only
  onMount(() => {
    loadParticipation();
  });

  // Format date and time
  function formatDateTime(dateString: string): string {
    const dt = new Date(dateString);
    return dt.toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Format duration
  function formatDuration(start: string, end: string): string {
    const startDt = new Date(start);
    const endDt = new Date(end);
    const durationMs = endDt.getTime() - startDt.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours} hours`;
    } else {
      return `${minutes} minutes`;
    }
  }

  // Get event type badge color
  function getEventTypeColor(type: string): string {
    switch (type) {
      case "rehearsal":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "concert":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "retreat":
        return "bg-green-100 text-green-700 border-green-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  }

  // Find score by ID
  function getScoreById(scoreId: string) {
    return data.allScores.find((s: any) => s.id === scoreId);
  }

  // Toggle edit mode
  function startEditEvent() {
    editingEventId = data.event.id;
    const dt = parseDateTime(data.event.starts_at);
    const dur = calculateDuration(data.event.starts_at, data.event.ends_at);
    editForm = {
      title: data.event.title,
      description: data.event.description || "",
      location: data.event.location || "",
      event_type: data.event.event_type,
      date: dt.date,
      time: dt.time,
      duration: dur,
    };
  }

  function cancelEditEvent() {
    editingEventId = null;
    error = "";
  }

  // Update event
  async function saveEvent() {
    updatingEvent = true;
    error = "";

    try {
      // Calculate starts_at and ends_at from date, time, duration
      const startsAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
      const endsAt = calculateEndDateTime(editForm.date, editForm.time, editForm.duration);
      
      const response = await fetch(`/api/events/${data.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          location: editForm.location,
          event_type: editForm.event_type,
          starts_at: startsAt,
          ends_at: endsAt,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to update event");
      }

      const updated = (await response.json()) as any;

      // Update local state
      data.event.title = updated.title;
      data.event.description = updated.description;
      data.event.location = updated.location;
      data.event.event_type = updated.event_type;
      data.event.starts_at = updated.starts_at;
      data.event.ends_at = updated.ends_at;

      editingEventId = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update event";
      setTimeout(() => (error = ""), 5000);
    } finally {
      updatingEvent = false;
    }
  }

  // Delete event
  async function deleteEvent() {
    const confirmed = confirm(
      `Are you sure you want to delete "${data.event.title}"?\n\nThis will also remove all program entries. This action cannot be undone.`,
    );

    if (!confirmed) return;

    deletingEvent = true;
    error = "";

    try {
      const response = await fetch(`/api/events/${data.event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to delete event");
      }

      // Redirect to events list
      goto("/events");
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete event";
      setTimeout(() => (error = ""), 5000);
      deletingEvent = false;
    }
  }

  // Add score to program
  async function addToProgram() {
    if (!selectedScoreId) return;

    addingScore = true;
    error = "";

    try {
      const response = await fetch(`/api/events/${data.event.id}/program`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score_id: selectedScoreId,
          position: program.length,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to add score to program");
      }

      // Reload program
      const updatedProgram = (await response.json()) as any;
      program = updatedProgram;

      // Update available scores
      availableScores = data.allScores.filter(
        (s: any) => !program.some((p) => p.score_id === s.id),
      );
      selectedScoreId = "";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add score";
      setTimeout(() => (error = ""), 5000);
    } finally {
      addingScore = false;
    }
  }

  // Remove score from program
  async function removeFromProgram(scoreId: string) {
    const score = getScoreById(scoreId);
    const confirmed = confirm(`Remove "${score?.title}" from the program?`);

    if (!confirmed) return;

    removingScoreId = scoreId;
    error = "";

    try {
      const response = await fetch(
        `/api/events/${data.event.id}/program/${scoreId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to remove score");
      }

      // Update local state
      program = program.filter((p) => p.score_id !== scoreId);

      // Update available scores
      availableScores = data.allScores.filter(
        (s: any) => !program.some((p) => p.score_id === s.id),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove score";
      setTimeout(() => (error = ""), 5000);
    } finally {
      removingScoreId = null;
    }
  }

  // Reorder program (drag and drop)
  function moveUp(index: number) {
    if (index === 0) return;
    const newProgram = [...program];
    [newProgram[index - 1], newProgram[index]] = [
      newProgram[index],
      newProgram[index - 1],
    ];
    program = newProgram;
    saveReorder();
  }

  function moveDown(index: number) {
    if (index === program.length - 1) return;
    const newProgram = [...program];
    [newProgram[index], newProgram[index + 1]] = [
      newProgram[index + 1],
      newProgram[index],
    ];
    program = newProgram;
    saveReorder();
  }

  async function saveReorder() {
    reorderingProgram = true;
    error = "";

    try {
      const response = await fetch(
        `/api/events/${data.event.id}/program/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score_ids: program.map((p) => p.score_id),
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to reorder program");
      }

      // Program successfully reordered
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to reorder program";
      setTimeout(() => (error = ""), 5000);
    } finally {
      reorderingProgram = false;
    }
  }

  // Participation functions
  async function loadParticipation() {
    // Prevent concurrent loads
    if (loadingParticipation) return;
    
    loadingParticipation = true;
    try {
      const response = await fetch(`/api/events/${data.event.id}/participation`);
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
    error = "";

    try {
      const response = await fetch(`/api/events/${data.event.id}/participation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || "Failed to update RSVP");
      }

      // Update local state for immediate reactivity
      if (myParticipation) {
        myParticipation = { ...myParticipation, plannedStatus: status };
      } else {
        // For new participation, just update the status (server handles full record)
        myParticipation = { ...data.myParticipation, plannedStatus: status } as any;
      }
      
      // Reload full participation data in background
      await loadParticipation();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update RSVP";
      setTimeout(() => (error = ""), 5000);
    } finally {
      updatingRsvp = false;
    }
  }

  async function updateAttendance(memberId: string, status: ActualStatus) {
    recordingAttendance[memberId] = true;
    error = "";

    try {
      const response = await fetch(`/api/events/${data.event.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, status }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || "Failed to record attendance");
      }

      // Reload participation data
      await loadParticipation();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to record attendance";
      setTimeout(() => (error = ""), 5000);
    } finally {
      recordingAttendance[memberId] = false;
    }
  }

  async function markAllPresent() {
    const confirmed = confirm("Mark all members as present?");
    if (!confirmed) return;

    bulkUpdatingAttendance = true;
    error = "";

    try {
      const updates = participationData.map((p) => ({
        memberId: p.memberId,
        status: "present" as ActualStatus,
      }));

      const response = await fetch(`/api/events/${data.event.id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || "Failed to mark all present");
      }

      // Reload participation data
      await loadParticipation();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to mark all present";
      setTimeout(() => (error = ""), 5000);
    } finally {
      bulkUpdatingAttendance = false;
    }
  }

  // Calculate section summary
  function getSectionSummary(): string {
    if (participationData.length === 0) return "";

    // Group by section abbreviation and count "yes" RSVPs
    const sectionCounts: Record<string, number> = {};
    let totalYes = 0;

    participationData.forEach((p) => {
      if (p.plannedStatus === "yes" && p.primarySection) {
        const abbr = p.primarySection.abbreviation;
        sectionCounts[abbr] = (sectionCounts[abbr] || 0) + 1;
        totalYes++;
      }
    });

    // Sort sections by display_order (from section data)
    // Map section abbreviations to their display order for proper sorting
    const sectionOrder = new Map<string, number>();
    participationData.forEach((p) => {
      if (p.primarySection) {
        sectionOrder.set(p.primarySection.abbreviation, p.primarySection.displayOrder ?? 999);
      }
    });
    
    const orderedSections = Object.entries(sectionCounts)
      .sort(([a], [b]) => {
        const orderA = sectionOrder.get(a) ?? 999;
        const orderB = sectionOrder.get(b) ?? 999;
        return orderA - orderB;
      });

    if (orderedSections.length === 0) return "No RSVPs yet";

    const summary = orderedSections
      .map(([section, count]) => `${section}: ${count}`)
      .join("  ");

    return `${summary}  (${totalYes} total)`;
  }

  // Group members by section
  function getMembersBySection() {
    const grouped: Record<string, any[]> = {};

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

<svelte:head>
  <title>{data.event.title} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <!-- Back Button -->
  <div class="mb-6">
    <a
      href="/events"
      class="inline-flex items-center text-blue-600 hover:text-blue-800"
    >
      <svg
        class="mr-1 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to Events
    </a>
  </div>

  {#if error}
    <div class="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
      {error}
    </div>
  {/if}

  <!-- Event Details Card -->
  <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    {#if editingEventId}
      <!-- Edit Mode -->
      <div class="space-y-4">
        <div>
          <label
            for="edit-title"
            class="block text-sm font-medium text-gray-700">Title</label
          >
          <input
            type="text"
            id="edit-title"
            bind:value={editForm.title}
            class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label for="edit-type" class="block text-sm font-medium text-gray-700"
            >Type</label
          >
          <select
            id="edit-type"
            bind:value={editForm.event_type}
            class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          >
            <option value="rehearsal">Rehearsal</option>
            <option value="concert">Concert</option>
            <option value="retreat">Retreat</option>
          </select>
        </div>
        <div>
          <label
            for="edit-location"
            class="block text-sm font-medium text-gray-700">Location</label
          >
          <input
            type="text"
            id="edit-location"
            bind:value={editForm.location}
            class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>
        
        <!-- Date & Time Section -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Date -->
          <div>
            <label for="edit-date" class="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              id="edit-date"
              bind:value={editForm.date}
              class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          
          <!-- Start Time -->
          <div>
            <label for="edit-time" class="block text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="time"
              id="edit-time"
              bind:value={editForm.time}
              class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          
          <!-- Duration -->
          <div>
            <label for="edit-duration" class="block text-sm font-medium text-gray-700">Duration</label>
            <select
              id="edit-duration"
              bind:value={editForm.duration}
              class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={150}>2.5 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={360}>6 hours</option>
              <option value={480}>8 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
              <option value={2880}>2 days</option>
              <option value={4320}>3 days</option>
            </select>
          </div>
          
          <!-- Calculated End Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700">Ends at</label>
            <div class="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-700">
              <span class="font-medium">{editEndTimeDisplay.time}</span>
              {#if editEndTimeDisplay.nextDay}
                <span class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">+1 day</span>
              {/if}
            </div>
          </div>
        </div>
        
        <div>
          <label
            for="edit-description"
            class="block text-sm font-medium text-gray-700">Description</label
          >
          <textarea
            id="edit-description"
            bind:value={editForm.description}
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          ></textarea>
        </div>
        <div class="flex gap-2">
          <button
            onclick={saveEvent}
            disabled={updatingEvent}
            class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {updatingEvent ? "Saving..." : "Save Changes"}
          </button>
          <button
            onclick={cancelEditEvent}
            disabled={updatingEvent}
            class="rounded-lg border border-gray-300 px-4 py-2 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <!-- View Mode -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <!-- Event Type Badge -->
          <div class="mb-3">
            <span
              class="inline-block rounded-full border px-3 py-1 text-xs font-medium {getEventTypeColor(
                data.event.event_type,
              )}"
            >
              {data.event.event_type}
            </span>
          </div>

          <!-- Title -->
          <h1 class="mb-2 text-3xl font-bold text-gray-900">
            {data.event.title}
          </h1>

          <!-- Date and Time -->
          <div class="mb-4 text-gray-600">
            <div class="flex items-center gap-2">
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{formatDateTime(data.event.starts_at)}</span>
            </div>
            <div class="ml-7 text-sm text-gray-500">
              Duration: {formatDuration(
                data.event.starts_at,
                data.event.ends_at || data.event.starts_at,
              )}
            </div>
          </div>

          <!-- Location -->
          {#if data.event.location}
            <div class="mb-4 flex items-center gap-2 text-gray-600">
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{data.event.location}</span>
            </div>
          {/if}

          <!-- Description -->
          {#if data.event.description}
            <p class="text-gray-600">{data.event.description}</p>
          {/if}
        </div>

        <!-- Action Buttons -->
        {#if data.canManage}
          <div class="ml-4 flex gap-2">
            <button
              onclick={startEditEvent}
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-50"
              title="Edit event"
            >
              Edit
            </button>
            <button
              onclick={deleteEvent}
              disabled={deletingEvent}
              class="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              title="Delete event"
            >
              {deletingEvent ? "Deleting..." : "Delete"}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Participation Section -->
  <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <h2 class="mb-4 text-2xl font-semibold">Participation</h2>

    <!-- My RSVP -->
    {#if !data.hasStarted}
      <div class="mb-6 rounded-lg bg-blue-50 p-4">
        <h3 class="mb-2 font-semibold text-blue-900">Your RSVP</h3>
        <div class="flex gap-2">
          <button
            onclick={() => updateMyRsvp("yes")}
            disabled={updatingRsvp}
            class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus === 'yes'
              ? 'bg-green-600 text-white border-green-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
          >
            Yes
          </button>
          <button
            onclick={() => updateMyRsvp("no")}
            disabled={updatingRsvp}
            class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus === 'no'
              ? 'bg-red-600 text-white border-red-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
          >
            No
          </button>
          <button
            onclick={() => updateMyRsvp("maybe")}
            disabled={updatingRsvp}
            class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus === 'maybe'
              ? 'bg-yellow-600 text-white border-yellow-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
          >
            Maybe
          </button>
          <button
            onclick={() => updateMyRsvp("late")}
            disabled={updatingRsvp}
            class="rounded-lg border px-4 py-2 text-sm font-medium transition {myParticipation?.plannedStatus === 'late'
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
            Your RSVP: <span class="font-medium capitalize">{myParticipation.plannedStatus}</span> (locked - event has started)
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
                      <span class="ml-2 rounded-full px-2 py-0.5 text-xs {member.plannedStatus === 'yes'
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
    {#if data.hasStarted && data.canRecordAttendance}
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
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  Member
                </th>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  Section
                </th>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  RSVP
                </th>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  Attendance
                </th>
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
                        class="rounded border px-2 py-1 text-xs transition {member.actualStatus === 'present'
                          ? 'bg-green-600 text-white border-green-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
                      >
                        Present
                      </button>
                      <button
                        onclick={() => updateAttendance(member.memberId, "absent")}
                        disabled={recordingAttendance[member.memberId]}
                        class="rounded border px-2 py-1 text-xs transition {member.actualStatus === 'absent'
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
                      >
                        Absent
                      </button>
                      <button
                        onclick={() => updateAttendance(member.memberId, "late")}
                        disabled={recordingAttendance[member.memberId]}
                        class="rounded border px-2 py-1 text-xs transition {member.actualStatus === 'late'
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
  </div>

  <!-- Program (Setlist) Section -->
  <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-2xl font-semibold">Program</h2>
      {#if data.canManage && program.length > 0}
        <span class="text-sm text-gray-500"
          >{program.length} piece{program.length !== 1 ? "s" : ""}</span
        >
      {/if}
    </div>

    {#if program.length === 0}
      <div class="py-8 text-center text-gray-500">
        <p>No scores in the program yet.</p>
        {#if data.canManage}
          <p class="mt-2 text-sm">Add scores below to build the program.</p>
        {/if}
      </div>
    {:else}
      <div class="space-y-2">
        {#each program as entry, index (entry.score_id)}
          {@const score = getScoreById(entry.score_id)}
          {#if score}
            <div
              class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <!-- Position -->
              <div class="shrink-0 text-2xl font-bold text-gray-400">
                {index + 1}
              </div>

              <!-- Score Details -->
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900">{score.title}</h3>
                {#if score.composer}
                  <p class="text-sm text-gray-600">{score.composer}</p>
                {/if}
                {#if entry.notes}
                  <p class="mt-1 text-sm italic text-gray-500">{entry.notes}</p>
                {/if}
              </div>

              <!-- Actions -->
              {#if data.canManage}
                <div class="flex gap-1">
                  <button
                    onclick={() => moveUp(index)}
                    disabled={index === 0 || reorderingProgram}
                    class="rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onclick={() => moveDown(index)}
                    disabled={index === program.length - 1 || reorderingProgram}
                    class="rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onclick={() => removeFromProgram(entry.score_id)}
                    disabled={removingScoreId === entry.score_id}
                    class="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
                    title="Remove from program"
                  >
                    <svg
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Add Score to Program -->
    {#if data.canManage}
      <div class="mt-6 border-t border-gray-200 pt-6">
        <h3 class="mb-3 text-lg font-semibold">Add to Program</h3>

        {#if availableScores.length === 0}
          <p class="text-sm text-gray-500">
            All scores have been added to the program.
          </p>
        {:else}
          <div class="flex gap-2">
            <select
              bind:value={selectedScoreId}
              class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select a score...</option>
              {#each availableScores as score (score.id)}
                <option value={score.id}>
                  {score.title}{score.composer ? ` - ${score.composer}` : ""}
                </option>
              {/each}
            </select>
            <button
              onclick={addToProgram}
              disabled={!canAddScore}
              class="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {addingScore ? "Adding..." : "Add"}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
