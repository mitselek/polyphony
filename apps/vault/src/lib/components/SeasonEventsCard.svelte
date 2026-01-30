<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	interface Event {
		id: string;
		title: string;
		starts_at: string;
		event_type: string;
		location: string | null;
	}

	interface Props {
		seasonId: string;
		events: Event[];
		canManage: boolean;
	}

	let { seasonId, events, canManage }: Props = $props();

	function formatDateTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getEventTypeBadge(eventType: string): { bg: string; text: string } {
		switch (eventType) {
			case 'concert':
				return { bg: 'bg-purple-100', text: 'text-purple-800' };
			case 'rehearsal':
				return { bg: 'bg-blue-100', text: 'text-blue-800' };
			case 'retreat':
				return { bg: 'bg-green-100', text: 'text-green-800' };
			default:
				return { bg: 'bg-gray-100', text: 'text-gray-800' };
		}
	}

	// ============================================================================
	// TODAY BOOKMARK FOR EVENTS LIST
	// ============================================================================
	
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
	// Find where "today" falls in the sorted events list
	// Returns the index AFTER which to show the bookmark (-1 if before all, events.length if after all)
	let todayPosition = $derived.by(() => {
		if (events.length === 0) return -1;
		
		for (let i = 0; i < events.length; i++) {
			const eventDate = new Date(events[i].starts_at);
			eventDate.setHours(0, 0, 0, 0);
			
			if (eventDate.getTime() > today.getTime()) {
				return i; // Today falls before this event
			}
		}
		return events.length; // Today is after all events
	});
	
	// Show bookmark only if today is "in the middle" (not before first or after last)
	let showTodayBookmark = $derived(todayPosition > 0 && todayPosition < events.length);
	
	// Show navigation for long lists (more than ~10 events = 2 screens)
	let showEventNavigation = $derived(events.length > 10);
</script>

<section id="events">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-semibold">Events in this Season</h2>
		{#if canManage}
			<a
				href="/events/new?season={seasonId}"
				class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
			>
				+ Add Event
			</a>
		{/if}
	</div>

	{#if events.length === 0}
		<Card padding="lg">
			<div class="py-8 text-center text-gray-500">
				<p>No events in this season yet.</p>
				{#if canManage}
					<p class="mt-2">
						<a href="/events/new" class="text-blue-600 hover:underline">
							Create an event
						</a>
					</p>
				{/if}
			</div>
		</Card>
	{:else}
		<!-- Intra-list navigation for long lists -->
		{#if showEventNavigation}
			<nav class="mb-3 flex items-center justify-center gap-4 text-sm">
				<a href="#event-first" class="text-gray-500 hover:text-blue-600 transition">↑ First</a>
				{#if showTodayBookmark}
					<span class="text-gray-300">|</span>
					<a href="#today" class="text-blue-600 hover:text-blue-800 font-medium transition">◆ Today</a>
				{/if}
				<span class="text-gray-300">|</span>
				<a href="#event-last" class="text-gray-500 hover:text-blue-600 transition">↓ Last</a>
			</nav>
		{/if}

		<div class="space-y-3">
			{#each events as event, index (event.id)}
				<!-- Today bookmark - shown before the first future event -->
				{#if index === todayPosition && showTodayBookmark}
					<div id="today" class="relative flex items-center py-2 scroll-mt-20">
						<div class="grow border-t border-amber-400"></div>
						<span class="mx-3 flex items-center gap-1.5 text-sm font-medium text-amber-600">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
								<path fill-rule="evenodd" d="M10 2a.75.75 0 01.75.75v.258a33.186 33.186 0 016.668.83.75.75 0 01-.336 1.461 31.28 31.28 0 00-1.103-.232l1.702 7.545a.75.75 0 01-.387.832A4.981 4.981 0 0115 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.77-7.849a31.743 31.743 0 00-3.339-.254v11.505l6.12 1.715a.75.75 0 01-.21 1.471H3.34a.75.75 0 01-.21-1.471l6.12-1.715V4.509a31.743 31.743 0 00-3.339.254l1.77 7.849a.75.75 0 01-.387.832A4.981 4.981 0 015 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.702-7.545c-.372.06-.741.125-1.103.232a.75.75 0 11-.336-1.462 33.186 33.186 0 016.668-.829V2.75A.75.75 0 0110 2zM5 12.467l-.97-4.31a29.05 29.05 0 00-1.003.232l.97 4.309a3.51 3.51 0 001.003-.231zm10 0a3.51 3.51 0 001.003.231l.97-4.31a29.05 29.05 0 00-1.003-.231l-.97 4.31z" clip-rule="evenodd" />
							</svg>
							Today
						</span>
						<div class="grow border-t border-amber-400"></div>
					</div>
				{/if}

				{@const badge = getEventTypeBadge(event.event_type)}
				<div id={index === 0 ? 'event-first' : index === events.length - 1 ? 'event-last' : undefined}>
					<Card variant="clickable" padding="md" href="/events/{event.id}">
						<div class="flex items-center justify-between">
							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-medium">{event.title}</h3>
									<span class="{badge.bg} {badge.text} rounded px-2 py-0.5 text-xs font-medium">
										{event.event_type}
									</span>
								</div>
								<p class="mt-1 text-sm text-gray-600">
									{formatDateTime(event.starts_at)}
									{#if event.location}
										<span class="text-gray-400">•</span>
										{event.location}
									{/if}
								</p>
							</div>
						</div>
					</Card>
				</div>
			{/each}
		</div>

		<p class="mt-6 text-sm text-gray-500">
			{events.length} event{events.length === 1 ? '' : 's'} in this season
		</p>
	{/if}
</section>
