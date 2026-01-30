<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';

	let { data }: { data: PageData } = $props();

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
</script>

<svelte:head>
	<title>{data.season.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Back link -->
	<div class="mb-4">
		<a href="/seasons" class="text-blue-600 hover:underline">← All Seasons</a>
	</div>

	<div class="mb-8">
		<h1 class="text-3xl font-bold">{data.season.name}</h1>
		<p class="mt-1 text-gray-600">
			Starts {new Date(data.season.start_date + 'T00:00:00').toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})}
		</p>
	</div>

	<!-- Events in this season -->
	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Events in this Season</h2>
			{#if data.canManage}
				<a
					href="/events/new?season={data.season.id}"
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
				>
					+ Add Event
				</a>
			{/if}
		</div>

		{#if data.events.length === 0}
			<Card padding="lg">
				<div class="py-8 text-center text-gray-500">
					<p>No events in this season yet.</p>
					{#if data.canManage}
						<p class="mt-2">
							<a href="/events/new" class="text-blue-600 hover:underline">
								Create an event
							</a>
						</p>
					{/if}
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each data.events as event (event.id)}
					{@const badge = getEventTypeBadge(event.event_type)}
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
				{/each}
			</div>

			<p class="mt-6 text-sm text-gray-500">
				{data.events.length} event{data.events.length === 1 ? '' : 's'} in this season
			</p>
		{/if}
	</section>
</div>
