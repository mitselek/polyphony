<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import type { EventType } from "$lib/types";
  import { goto } from "$app/navigation";
  import { formatDateTimeFull, formatDurationBetween, calculateDurationMinutes, DEFAULT_EVENT_DURATION_MINUTES } from "$lib/utils/formatters";
  import { getEventTypeBadgeClass } from "$lib/utils/badges";

  interface EventData {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_type: EventType;
    starts_at: string;
    ends_at: string | null;
  }

  interface Props {
    event: EventData;
    canManage: boolean;
    error?: string;
    onError?: (message: string) => void;
  }

  let { event = $bindable(), canManage, error = "", onError = () => {} }: Props = $props();

  // Edit state
  let editingEventId = $state<string | null>(null);
  let updatingEvent = $state(false);
  let deletingEvent = $state(false);
  let editForm = $state({
    title: "",
    description: "",
    location: "",
    event_type: "rehearsal" as EventType,
    date: "",
    time: "",
    durationDays: 0,
    durationHours: 2,
    durationMinutes: 0,
  });

  // Calculate total duration in minutes
  let editFormDuration = $derived(
    editForm.durationDays * 24 * 60 + editForm.durationHours * 60 + editForm.durationMinutes
  );

  // Format end date/time preview
  let editEndDateTimeDisplay = $derived.by(() => {
    if (!editForm.date || !editForm.time) return "-";
    try {
      const endDateTime = calculateEndDateTime(editForm.date, editForm.time, editFormDuration);
      return new Date(endDateTime).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "-";
    }
  });

  // Helper functions
  function parseDateTime(isoString: string): { date: string; time: string } {
    const d = new Date(isoString);
    const date = d.toISOString().slice(0, 10);
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  }

  function splitDuration(totalMinutes: number): {
    days: number;
    hours: number;
    minutes: number;
  } {
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingAfterDays = totalMinutes % (24 * 60);
    const hours = Math.floor(remainingAfterDays / 60);
    const minutes = remainingAfterDays % 60;
    return { days, hours, minutes };
  }

  function calculateEndDateTime(date: string, time: string, durationMinutes: number): string {
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    return endDate.toISOString();
  }

  // Toggle edit mode
  function startEditEvent() {
    editingEventId = event.id;
    const dt = parseDateTime(event.starts_at);
    // Use default duration if ends_at is null
    const dur = event.ends_at ? calculateDurationMinutes(event.starts_at, event.ends_at) : DEFAULT_EVENT_DURATION_MINUTES;
    const durParts = splitDuration(dur);
    editForm = {
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      event_type: event.event_type,
      date: dt.date,
      time: dt.time,
      durationDays: durParts.days,
      durationHours: durParts.hours,
      durationMinutes: durParts.minutes,
    };
  }

  function cancelEditEvent() {
    editingEventId = null;
    onError("");
  }

  // Update event
  async function saveEvent() {
    updatingEvent = true;
    onError("");

    try {
      const startsAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
      const endsAt = calculateEndDateTime(editForm.date, editForm.time, editFormDuration);

      const response = await fetch(`/api/events/${event.id}`, {
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

      // Update event through bindable prop
      event = {
        ...event,
        title: updated.title,
        description: updated.description,
        location: updated.location,
        event_type: updated.event_type,
        starts_at: updated.starts_at,
        ends_at: updated.ends_at,
      };

      editingEventId = null;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      updatingEvent = false;
    }
  }

  // Delete event
  async function deleteEvent() {
    const confirmed = confirm(
      `Are you sure you want to delete "${event.title}"?\n\nThis will also remove all program entries. This action cannot be undone.`
    );

    if (!confirmed) return;

    deletingEvent = true;
    onError("");

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.message || "Failed to delete event");
      }

      goto("/events");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete event");
      deletingEvent = false;
    }
  }
</script>

<Card padding="lg" class="mb-8">
  {#if editingEventId}
    <!-- Edit Mode -->
    <div class="space-y-4">
      <div>
        <label for="edit-title" class="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          id="edit-title"
          bind:value={editForm.title}
          class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label for="edit-type" class="block text-sm font-medium text-gray-700">Type</label>
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
        <label for="edit-location" class="block text-sm font-medium text-gray-700">Location</label>
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
      </div>

      <!-- Duration Row -->
      <fieldset>
        <legend class="block text-sm font-medium text-gray-700">Duration</legend>
        <div class="mt-1 flex items-center gap-3">
          <div class="flex items-center gap-1">
            <input
              type="number"
              id="edit-duration-days"
              bind:value={editForm.durationDays}
              min="0"
              max="30"
              class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none"
            />
            <span class="text-sm text-gray-600">days</span>
          </div>
          <div class="flex items-center gap-1">
            <input
              type="number"
              id="edit-duration-hours"
              bind:value={editForm.durationHours}
              min="0"
              max="23"
              class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none"
            />
            <span class="text-sm text-gray-600">hours</span>
          </div>
          <div class="flex items-center gap-1">
            <input
              type="number"
              id="edit-duration-minutes"
              bind:value={editForm.durationMinutes}
              min="0"
              max="59"
              step="5"
              class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none"
            />
            <span class="text-sm text-gray-600">min</span>
          </div>
        </div>
      </fieldset>

      <!-- Calculated End DateTime -->
      <div>
        <span id="ends-at-label" class="block text-sm font-medium text-gray-700">Ends at</span>
        <div
          aria-labelledby="ends-at-label"
          class="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-700"
        >
          <span class="font-medium">{editEndDateTimeDisplay}</span>
        </div>
      </div>

      <div>
        <label for="edit-description" class="block text-sm font-medium text-gray-700"
          >Description</label
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
            class="inline-block rounded-full border px-3 py-1 text-xs font-medium {getEventTypeBadgeClass(
              event.event_type
            )}"
          >
            {event.event_type}
          </span>
        </div>

        <!-- Title -->
        <h1 class="mb-2 text-3xl font-bold text-gray-900">
          {event.title}
        </h1>

        <!-- Date and Time -->
        <div class="mb-4 text-gray-600">
          <div class="flex items-center gap-2">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formatDateTimeFull(event.starts_at)}</span>
          </div>
          <div class="ml-7 text-sm text-gray-500">
            Duration: {event.ends_at ? formatDurationBetween(event.starts_at, event.ends_at) : '-'}
          </div>
        </div>

        <!-- Location -->
        {#if event.location}
          <div class="mb-4 flex items-center gap-2 text-gray-600">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <span>{event.location}</span>
          </div>
        {/if}

        <!-- Description -->
        {#if event.description}
          <p class="text-gray-600">{event.description}</p>
        {/if}
      </div>

      <!-- Action Buttons -->
      {#if canManage}
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
</Card>
