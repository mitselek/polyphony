<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import type { SeasonRepertoireWork, SeasonRepertoire, Work } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Local state for repertoire (reactive copy) - explicit types for filter/find callbacks
	let repertoire: SeasonRepertoire = $state(untrack(() => data.repertoire));
	let availableWorks: Work[] = $state(untrack(() => data.availableWorks));

	// State for UI interactions
	let selectedWorkId = $state('');
	let addingWork = $state(false);
	let removingWorkId = $state<string | null>(null);
	let error = $state('');
	let expandedWorkId = $state<string | null>(null);

	// Sync on navigation
	$effect(() => {
		repertoire = data.repertoire;
		availableWorks = data.availableWorks;
	});

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

	async function addWorkToSeason() {
		if (!selectedWorkId) return;

		addingWork = true;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workId: selectedWorkId })
			});

			if (!response.ok) {
			const result = await response.json() as { error?: string };
			}

			// Refresh repertoire
			const repertoireResponse = await fetch(`/api/seasons/${data.season.id}/works`);
			if (repertoireResponse.ok) {
				repertoire = await repertoireResponse.json();
			}

			// Update available works
			availableWorks = availableWorks.filter(w => w.id !== selectedWorkId);
			selectedWorkId = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add work';
		} finally {
			addingWork = false;
		}
	}

	async function removeWorkFromSeason(seasonWorkId: string, workId: string) {
		if (!confirm('Remove this work from the season repertoire?')) return;

		removingWorkId = seasonWorkId;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/${seasonWorkId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove work');
			}

			// Update local state
			const removedWork = repertoire.works.find(w => w.seasonWorkId === seasonWorkId);
			repertoire = { ...repertoire, works: repertoire.works.filter(w => w.seasonWorkId !== seasonWorkId) };
			
			// Add back to available works
			if (removedWork) {
				availableWorks = [...availableWorks, removedWork.work].sort((a, b) => a.title.localeCompare(b.title));
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove work';
		} finally {
			removingWorkId = null;
		}
	}

	function toggleExpanded(seasonWorkId: string) {
		expandedWorkId = expandedWorkId === seasonWorkId ? null : seasonWorkId;
	}

	function getLicenseBadge(licenseType: string): { bg: string; text: string } {
		switch (licenseType) {
			case 'public_domain':
				return { bg: 'bg-green-100', text: 'text-green-800' };
			case 'licensed':
				return { bg: 'bg-amber-100', text: 'text-amber-800' };
			case 'owned':
				return { bg: 'bg-blue-100', text: 'text-blue-800' };
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

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
			<button onclick={() => error = ''} class="ml-2 text-red-800 hover:underline">Dismiss</button>
		</div>
	{/if}

	<!-- Repertoire Section -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Season Repertoire</h2>
		</div>

		{#if data.canManageLibrary && availableWorks.length > 0}
			<div class="mb-4 flex gap-2">
				<select 
					bind:value={selectedWorkId}
					class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					disabled={addingWork}
				>
					<option value="">Select a work to add...</option>
					{#each availableWorks as work (work.id)}
						<option value={work.id}>
							{work.title}{work.composer ? ` - ${work.composer}` : ''}
						</option>
					{/each}
				</select>
				<button
					onclick={addWorkToSeason}
					disabled={!selectedWorkId || addingWork}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
				>
					{addingWork ? 'Adding...' : 'Add Work'}
				</button>
			</div>
		{/if}

		{#if repertoire.works.length === 0}
			<Card padding="lg">
				<div class="py-8 text-center text-gray-500">
					<p>No works in this season's repertoire yet.</p>
					{#if availableWorks.length === 0}
						<p class="mt-2">
							<a href="/library/works/new" class="text-blue-600 hover:underline">
								Add works to the library first
							</a>
						</p>
					{/if}
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each repertoire.works as repWork (repWork.seasonWorkId)}
					<Card padding="md">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<button
									onclick={() => toggleExpanded(repWork.seasonWorkId)}
									class="flex items-center gap-2 text-left hover:text-blue-600"
								>
									<span class="text-gray-400 transition-transform" class:rotate-90={expandedWorkId === repWork.seasonWorkId}>
										▶
									</span>
									<h3 class="font-medium">{repWork.work.title}</h3>
								</button>
								{#if repWork.work.composer}
									<p class="ml-6 text-sm text-gray-600">{repWork.work.composer}</p>
								{/if}
								{#if repWork.notes}
									<p class="ml-6 mt-1 text-sm italic text-gray-500">{repWork.notes}</p>
								{/if}
								
								<!-- Editions summary -->
								<div class="ml-6 mt-1 text-xs text-gray-500">
									{#if repWork.editions.length === 0}
										<span class="text-amber-600">No editions selected</span>
									{:else if repWork.editions.length === 1}
										<span>1 edition</span>
									{:else}
										<span>{repWork.editions.length} editions</span>
									{/if}
								</div>
							</div>

							{#if data.canManageLibrary}
								<button
									onclick={() => removeWorkFromSeason(repWork.seasonWorkId, repWork.work.id)}
									disabled={removingWorkId === repWork.seasonWorkId}
									class="text-red-600 hover:text-red-800 disabled:opacity-50"
									title="Remove from repertoire"
								>
									{removingWorkId === repWork.seasonWorkId ? '...' : '✕'}
								</button>
							{/if}
						</div>

						<!-- Expanded editions list -->
						{#if expandedWorkId === repWork.seasonWorkId}
							<div class="ml-6 mt-4 border-t pt-4">
								<h4 class="mb-2 text-sm font-medium text-gray-700">Editions:</h4>
								{#if repWork.editions.length === 0}
									<p class="text-sm text-gray-500">
										No editions selected. 
										<a href="/library/works/{repWork.work.id}" class="text-blue-600 hover:underline">
											View work editions
										</a>
									</p>
								{:else}
									<ul class="space-y-2">
										{#each repWork.editions as ed (ed.workEditionId)}
											{@const badge = getLicenseBadge(ed.edition.licenseType)}
											<li class="flex items-center gap-2 text-sm">
												{#if ed.isPrimary}
													<span class="text-amber-500" title="Primary edition">★</span>
												{:else}
													<span class="text-gray-300">☆</span>
												{/if}
												<a 
													href="/library/editions/{ed.edition.id}" 
													class="hover:text-blue-600 hover:underline"
												>
													{ed.edition.name}
												</a>
												<span class="{badge.bg} {badge.text} rounded px-1.5 py-0.5 text-xs">
													{ed.edition.licenseType.replace('_', ' ')}
												</span>
												{#if ed.edition.voicing}
													<span class="text-gray-400">({ed.edition.voicing})</span>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{/if}
					</Card>
				{/each}
			</div>

			<p class="mt-4 text-sm text-gray-500">
				{repertoire.works.length} work{repertoire.works.length === 1 ? '' : 's'} in repertoire
			</p>
		{/if}
	</section>

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
