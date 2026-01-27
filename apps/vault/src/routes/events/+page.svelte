<script lang="ts">
	import type { PageData } from './$types';
	import type { EventType } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Filter state
	let selectedFilter = $state<EventType | 'all'>('all');

	// Filtered events based on selected type
	let filteredEvents = $derived(
		selectedFilter === 'all'
			? data.events
			: data.events.filter((e) => e.event_type === selectedFilter)
	);

	// Format date and time
	function formatDateTime(dateString: string): { date: string; time: string } {
		const dt = new Date(dateString);
		const date = dt.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		const time = dt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
		return { date, time };
	}

	// Get event type badge color
	function getEventTypeColor(type: EventType): string {
		switch (type) {
			case 'rehearsal':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'concert':
				return 'bg-purple-100 text-purple-800 border-purple-200';
			case 'retreat':
				return 'bg-green-100 text-green-800 border-green-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}
</script>

<svelte:head>
	<title>Events | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Events</h1>
			<p class="mt-2 text-gray-600">Upcoming rehearsals, concerts, and retreats</p>
		</div>
		<div class="flex gap-3">
			<a
				href="/events/roster"
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
			>
				View Roster
			</a>
			{#if data.canCreate}
				<a
					href="/events/new"
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
				>
					Create Event
				</a>
			{/if}
		</div>
	</div>

	<!-- Filter Buttons -->
	<div class="mb-6 flex gap-2">
		<button
			onclick={() => (selectedFilter = 'all')}
			class="rounded-lg border px-4 py-2 text-sm transition {selectedFilter === 'all'
				? 'border-blue-500 bg-blue-50 text-blue-700'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
		>
			All Events
		</button>
		<button
			onclick={() => (selectedFilter = 'rehearsal')}
			class="rounded-lg border px-4 py-2 text-sm transition {selectedFilter === 'rehearsal'
				? 'border-blue-500 bg-blue-50 text-blue-700'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
		>
			Rehearsals
		</button>
		<button
			onclick={() => (selectedFilter = 'concert')}
			class="rounded-lg border px-4 py-2 text-sm transition {selectedFilter === 'concert'
				? 'border-purple-500 bg-purple-50 text-purple-700'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
		>
			Concerts
		</button>
		<button
			onclick={() => (selectedFilter = 'retreat')}
			class="rounded-lg border px-4 py-2 text-sm transition {selectedFilter === 'retreat'
				? 'border-green-500 bg-green-50 text-green-700'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
		>
			Retreats
		</button>
	</div>

	<!-- Events List -->
	{#if filteredEvents.length === 0}
		<div class="py-12 text-center">
			<div class="mx-auto mb-4 w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-gray-400">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
				</svg>
			</div>
			<p class="text-gray-500">
				{#if selectedFilter === 'all'}
					No upcoming events scheduled.
				{:else}
					No {selectedFilter}s scheduled.
				{/if}
			</p>
			{#if data.canCreate}
				<a href="/events/new" class="mt-4 inline-block text-blue-600 hover:underline">
					Create your first event
				</a>
			{/if}
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredEvents as event (event.id)}
				{@const { date, time } = formatDateTime(event.starts_at)}
				<a
					href="/events/{event.id}"
					class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
				>
					<!-- Event Type Badge -->
					<div class="mb-3">
						<span class="inline-block rounded-full border px-3 py-1 text-xs font-medium {getEventTypeColor(event.event_type)}">
							{event.event_type}
						</span>
					</div>

					<!-- Title -->
					<h3 class="mb-2 text-lg font-semibold text-gray-900">
						{event.title}
					</h3>

					<!-- Date and Time -->
					<div class="mb-3 space-y-1 text-sm text-gray-600">
						<div class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
							<span>{date}</span>
						</div>
						<div class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>{time}</span>
						</div>
					</div>

					<!-- Location (if provided) -->
					{#if event.location}
						<div class="mb-3 flex items-start gap-2 text-sm text-gray-600">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mt-0.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
							</svg>
							<span class="flex-1">{event.location}</span>
						</div>
					{/if}

					<!-- Description Preview (if provided) -->
					{#if event.description}
						<p class="text-sm text-gray-500 line-clamp-2">
							{event.description}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
