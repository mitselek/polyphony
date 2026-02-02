<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { EventType } from '$lib/types';
	import { EVENT_TYPES, getEventTypeLabel } from '$lib/utils/badges';
	import { getLocale } from '$lib/utils/locale';
	import Card from '$lib/components/Card.svelte';

	let { data }: { data: PageData } = $props();

	// Get the locale for date formatting
	let locale = $derived(getLocale(data.locale));

	// Form state
	let title = $state('');
	let description = $state('');
	let location = $state('');
	let eventType = $state<EventType>('rehearsal');
	let startDate = $state('');
	let startTime = $state('19:00');
	
	// Duration split into days/hours/minutes
	let durationDays = $state(0);
	let durationHours = $state(2);
	let durationMinutes = $state(0);
	
	// Computed total duration in minutes
	let duration = $derived(durationDays * 24 * 60 + durationHours * 60 + durationMinutes);
	
	// Repeat picker state
	let repeatFrequency = $state<'once' | 'weekly' | 'biweekly'>('once');
	let repeatCount = $state(4);
	
	// Generated events preview
	let generatedEvents = $state<{ date: string; time: string; datetime: string; checked: boolean }[]>([]);
	
	// Form submission state
	let submitting = $state(false);
	let error = $state('');

	// Generate preview dates whenever inputs change
	$effect(() => {
		if (!startDate || !startTime) {
			generatedEvents = [];
			return;
		}

		const events: typeof generatedEvents = [];
		const baseDate = new Date(`${startDate}T${startTime}`);
		
		if (repeatFrequency === 'once') {
			events.push({
				date: formatDate(baseDate),
				time: startTime,
				datetime: baseDate.toISOString(),
				checked: true
			});
		} else {
			const increment = repeatFrequency === 'weekly' ? 7 : 14;
			for (let i = 0; i < repeatCount; i++) {
				const eventDate = new Date(baseDate);
				eventDate.setDate(baseDate.getDate() + (i * increment));
				events.push({
					date: formatDate(eventDate),
					time: startTime,
					datetime: eventDate.toISOString(),
					checked: true
				});
			}
		}
		
		generatedEvents = events;
	});

	function formatDate(date: Date): string {
		return date.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Calculate end datetime from start + duration
	function calculateEndDateTime(startDateTime: Date, durationMinutes: number): Date {
		return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
	}

	// Format full end date and time
	function formatEndDateTime(startDateStr: string, startTimeStr: string, durationMinutes: number): string {
		if (!startDateStr || !startTimeStr) return '--';
		const startDateTime = new Date(`${startDateStr}T${startTimeStr}:00`);
		const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
		return endDateTime.toLocaleString(locale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Computed end datetime display
	let endDateTimeDisplay = $derived(formatEndDateTime(startDate, startTime, duration));

	// Initialize duration parts from settings
	$effect(() => {
		const defaultMins = data.defaultDuration;
		durationDays = Math.floor(defaultMins / (24 * 60));
		const remaining = defaultMins % (24 * 60);
		durationHours = Math.floor(remaining / 60);
		durationMinutes = remaining % 60;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		if (generatedEvents.filter(e => e.checked).length === 0) {
			error = 'Please select at least one event date';
			return;
		}

		submitting = true;
		error = '';

		try {
			// Build events array from checked preview items
			const events = generatedEvents
				.filter(e => e.checked)
				.map(e => {
					const startsAt = new Date(e.datetime);
					// Calculate end time by adding duration (handles overnight correctly)
					const endsAt = calculateEndDateTime(startsAt, duration);

					return {
						title,
						description: description || undefined,
						location: location || undefined,
						event_type: eventType,
						starts_at: startsAt.toISOString(),
						ends_at: endsAt.toISOString()
					};
				});

			const response = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ events })
			});

			if (!response.ok) {
			const data = await response.json() as any;
			}

			// Success - redirect to events list
			await goto('/events');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create events';
			submitting = false;
		}
	}

	function toggleEvent(index: number) {
		generatedEvents[index].checked = !generatedEvents[index].checked;
	}

	function selectAll() {
		generatedEvents = generatedEvents.map(e => ({ ...e, checked: true }));
	}

	function deselectAll() {
		generatedEvents = generatedEvents.map(e => ({ ...e, checked: false }));
	}
</script>

<svelte:head>
	<title>Create Event | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Create Event</h1>
		<p class="mt-2 text-gray-600">Schedule rehearsals, concerts, retreats, or festivals</p>
	</div>

	{#if error}
		<div class="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="space-y-8">
		<!-- Basic Info Section -->
		<Card padding="lg">
			<h2 class="mb-4 text-xl font-semibold">Event Details</h2>
			
			<div class="space-y-4">
				<!-- Title -->
				<div>
					<label for="title" class="block text-sm font-medium text-gray-700">
						Title <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="title"
						bind:value={title}
						required
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						placeholder="Weekly Rehearsal"
					/>
				</div>

				<!-- Event Type -->
				<div>
					<label for="event-type" class="block text-sm font-medium text-gray-700">
						Event Type <span class="text-red-500">*</span>
					</label>
					<select
						id="event-type"
						bind:value={eventType}
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					>
						{#each EVENT_TYPES as type}
							<option value={type}>{getEventTypeLabel(type)}</option>
						{/each}
					</select>
				</div>

				<!-- Location -->
				<div>
					<label for="location" class="block text-sm font-medium text-gray-700">
						Location
					</label>
					<input
						type="text"
						id="location"
						bind:value={location}
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						placeholder="Main Hall"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="description"
						bind:value={description}
						rows="3"
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						placeholder="Optional notes about this event"
					></textarea>
				</div>
			</div>
		</Card>

		<!-- Date & Time Section -->
		<Card padding="lg">
			<h2 class="mb-4 text-xl font-semibold">Date & Time</h2>
			
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Start Date -->
				<div>
					<label for="start-date" class="block text-sm font-medium text-gray-700">
						Start Date <span class="text-red-500">*</span>
					</label>
					<input
						type="date"
						id="start-date"
						bind:value={startDate}
						required
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					/>
				</div>

				<!-- Start Time -->
				<div>
					<label for="start-time" class="block text-sm font-medium text-gray-700">
						Start Time <span class="text-red-500">*</span>
					</label>
					<input
						type="time"
						id="start-time"
						bind:value={startTime}
						required
						step="60"
						class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					/>
				</div>

				<!-- Duration -->
				<fieldset class="col-span-2">
					<legend class="block text-sm font-medium text-gray-700">
						Duration
					</legend>
					<div class="mt-1 flex items-center gap-3">
						<div class="flex items-center gap-1">
							<input
								type="number"
								id="duration-days"
								bind:value={durationDays}
								min="0"
								max="30"
								class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm text-gray-600">days</span>
						</div>
						<div class="flex items-center gap-1">
							<input
								type="number"
								id="duration-hours"
								bind:value={durationHours}
								min="0"
								max="23"
								class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm text-gray-600">hours</span>
						</div>
						<div class="flex items-center gap-1">
							<input
								type="number"
								id="duration-minutes"
								bind:value={durationMinutes}
								min="0"
								max="59"
								step="5"
								class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm text-gray-600">min</span>
						</div>
					</div>
				</fieldset>

				<!-- Calculated End Date/Time (read-only display) -->
				<div class="col-span-2">
					<span id="ends-at-label" class="block text-sm font-medium text-gray-700">
						Ends at
					</span>
					<div aria-labelledby="ends-at-label" class="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-700">
						<span class="font-medium">{endDateTimeDisplay}</span>
					</div>
					<p class="mt-1 text-sm text-gray-500">
						Auto-calculated from start time + duration
					</p>
				</div>
			</div>
		</Card>

		<!-- Repeat Picker Section -->
		<Card padding="lg">
			<h2 class="mb-4 text-xl font-semibold">Repeat Pattern</h2>
			
			<div class="space-y-4">
				<!-- Frequency -->
				<div>
				<div class="block text-sm font-medium text-gray-700 mb-2">Frequency</div>
				<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (repeatFrequency = 'once')}
							class="flex-1 rounded-lg border px-4 py-2 text-sm transition {repeatFrequency === 'once'
								? 'border-blue-500 bg-blue-50 text-blue-700'
								: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							Once
						</button>
						<button
							type="button"
							onclick={() => (repeatFrequency = 'weekly')}
							class="flex-1 rounded-lg border px-4 py-2 text-sm transition {repeatFrequency === 'weekly'
								? 'border-blue-500 bg-blue-50 text-blue-700'
								: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							Weekly
						</button>
						<button
							type="button"
							onclick={() => (repeatFrequency = 'biweekly')}
							class="flex-1 rounded-lg border px-4 py-2 text-sm transition {repeatFrequency === 'biweekly'
								? 'border-blue-500 bg-blue-50 text-blue-700'
								: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							Bi-weekly
						</button>
					</div>
				</div>

				<!-- Repeat Count (only show for recurring) -->
				{#if repeatFrequency !== 'once'}
					<div>
						<label for="repeat-count" class="block text-sm font-medium text-gray-700">
							Number of Events
						</label>
						<input
							type="number"
							id="repeat-count"
							bind:value={repeatCount}
							min="1"
							max="52"
							class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						/>
						<p class="mt-1 text-sm text-gray-500">
							Create up to 52 {repeatFrequency} events
						</p>
					</div>
				{/if}
			</div>
		</Card>

		<!-- Preview Section -->
		{#if generatedEvents.length > 0}
			<Card padding="lg">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-xl font-semibold">Preview & Select</h2>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={selectAll}
							class="text-sm text-blue-600 hover:underline"
						>
							Select All
						</button>
						<button
							type="button"
							onclick={deselectAll}
							class="text-sm text-blue-600 hover:underline"
						>
							Deselect All
						</button>
					</div>
				</div>

				<p class="mb-4 text-sm text-gray-600">
					Uncheck dates to skip (e.g., holidays or conflicts). Only checked events will be created.
				</p>

				<div class="space-y-2">
					{#each generatedEvents as event, index (index)}
						{@const startDateTime = new Date(`${event.datetime}`)}
						{@const endDateTime = calculateEndDateTime(startDateTime, duration)}
						{@const endDisplay = endDateTime.toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
						<label class="flex items-center gap-3 rounded-lg border p-3 transition {event.checked
							? 'border-blue-200 bg-blue-50'
							: 'border-gray-200 bg-white'} cursor-pointer hover:bg-gray-50">
							<input
								type="checkbox"
								checked={event.checked}
								onchange={() => toggleEvent(index)}
								class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
							/>
							<div class="flex-1">
								<div class="font-medium text-gray-900">{event.date}</div>
								<div class="text-sm text-gray-500">
									{event.time} – {endDisplay}
								</div>
							</div>
						</label>
					{/each}
				</div>

				<p class="mt-4 text-sm text-gray-500">
					{generatedEvents.filter(e => e.checked).length} of {generatedEvents.length} events selected
				</p>
			</Card>
		{/if}

		<!-- Action Buttons -->
		<div class="flex justify-end gap-3">
			<a
				href="/events"
				class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50"
			>
				Cancel
			</a>
			<button
				type="submit"
				disabled={submitting || generatedEvents.filter(e => e.checked).length === 0}
				class="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? 'Creating...' : `Create ${generatedEvents.filter(e => e.checked).length} Event${generatedEvents.filter(e => e.checked).length !== 1 ? 's' : ''}`}
			</button>
		</div>
	</form>
</div>
