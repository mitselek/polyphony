<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import type { SeasonRepertoireWork, SeasonRepertoire, Work, Edition } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Local state for repertoire (reactive copy)
	let repertoire: SeasonRepertoire = $state(untrack(() => data.repertoire));
	let availableWorks: Work[] = $state(untrack(() => data.availableWorks));
	let workEditionsMap: Record<string, Edition[]> = $state(untrack(() => data.workEditionsMap));

	// State for UI interactions
	let selectedWorkId = $state('');
	let addingWork = $state(false);
	let removingWorkId = $state<string | null>(null);
	let error = $state('');
	let expandedWorkId = $state<string | null>(null);
	
	// Edition management
	let addingEditionTo = $state<string | null>(null);
	let selectedEditionId = $state('');
	let removingEditionId = $state<string | null>(null);
	let settingPrimaryId = $state<string | null>(null);
	
	// Notes editing
	let editingNotesFor = $state<string | null>(null);
	let notesInput = $state('');
	let savingNotes = $state(false);
	
	// Reordering
	let isReordering = $state(false);

	// Sync on navigation
	$effect(() => {
		repertoire = data.repertoire;
		availableWorks = data.availableWorks;
		workEditionsMap = data.workEditionsMap;
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

	// ============================================================================
	// TODAY BOOKMARK FOR EVENTS LIST
	// ============================================================================
	
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
	// Find where "today" falls in the sorted events list
	// Returns the index AFTER which to show the bookmark (-1 if before all, events.length if after all)
	let todayPosition = $derived.by(() => {
		if (data.events.length === 0) return -1;
		
		for (let i = 0; i < data.events.length; i++) {
			const eventDate = new Date(data.events[i].starts_at);
			eventDate.setHours(0, 0, 0, 0);
			
			if (eventDate.getTime() > today.getTime()) {
				return i; // Today falls before this event
			}
		}
		return data.events.length; // Today is after all events
	});
	
	// Show bookmark only if today is "in the middle" (not before first or after last)
	let showTodayBookmark = $derived(todayPosition > 0 && todayPosition < data.events.length);
	
	// Show navigation for long lists (more than ~10 events = 2 screens)
	let showEventNavigation = $derived(data.events.length > 10);

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

	// ============================================================================
	// WORK OPERATIONS
	// ============================================================================

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
				throw new Error(result.error ?? 'Failed to add work');
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

	async function handleReorderWorks(newOrder: string[]) {
		isReordering = true;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ seasonWorkIds: newOrder })
			});

			if (!response.ok) {
				throw new Error('Failed to reorder works');
			}

			// Update local state
			const reorderedWorks = newOrder.map(id => 
				repertoire.works.find(w => w.seasonWorkId === id)!
			).filter(Boolean);
			repertoire = { ...repertoire, works: reorderedWorks };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reorder works';
			// Refresh to get correct order
			const repertoireResponse = await fetch(`/api/seasons/${data.season.id}/works`);
			if (repertoireResponse.ok) {
				repertoire = await repertoireResponse.json();
			}
		} finally {
			isReordering = false;
		}
	}

	function toggleExpanded(seasonWorkId: string) {
		expandedWorkId = expandedWorkId === seasonWorkId ? null : seasonWorkId;
	}

	// ============================================================================
	// NOTES OPERATIONS
	// ============================================================================

	function startEditingNotes(repWork: SeasonRepertoireWork) {
		editingNotesFor = repWork.seasonWorkId;
		notesInput = repWork.notes ?? '';
	}

	function cancelEditingNotes() {
		editingNotesFor = null;
		notesInput = '';
	}

	async function saveNotes(seasonWorkId: string) {
		savingNotes = true;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/${seasonWorkId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: notesInput.trim() || null })
			});

			if (!response.ok) {
				throw new Error('Failed to save notes');
			}

			// Update local state
			repertoire = {
				...repertoire,
				works: repertoire.works.map(w => 
					w.seasonWorkId === seasonWorkId 
						? { ...w, notes: notesInput.trim() || null }
						: w
				)
			};
			editingNotesFor = null;
			notesInput = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save notes';
		} finally {
			savingNotes = false;
		}
	}

	// ============================================================================
	// EDITION OPERATIONS
	// ============================================================================

	function getAvailableEditionsForWork(repWork: SeasonRepertoireWork): Edition[] {
		const allEditions = workEditionsMap[repWork.work.id] ?? [];
		const selectedEditionIds = new Set(repWork.editions.map(e => e.edition.id));
		return allEditions.filter(e => !selectedEditionIds.has(e.id));
	}

	async function addEditionToWork(seasonWorkId: string) {
		if (!selectedEditionId) return;

		addingEditionTo = seasonWorkId;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/${seasonWorkId}/editions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ editionId: selectedEditionId })
			});

			if (!response.ok) {
				const result = await response.json() as { error?: string };
				throw new Error(result.error ?? 'Failed to add edition');
			}

			// Refresh repertoire to get updated editions
			const repertoireResponse = await fetch(`/api/seasons/${data.season.id}/works`);
			if (repertoireResponse.ok) {
				repertoire = await repertoireResponse.json();
			}
			selectedEditionId = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add edition';
		} finally {
			addingEditionTo = null;
		}
	}

	async function removeEditionFromWork(seasonWorkId: string, workEditionId: string) {
		removingEditionId = workEditionId;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/${seasonWorkId}/editions/${workEditionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove edition');
			}

			// Update local state
			repertoire = {
				...repertoire,
				works: repertoire.works.map(w => 
					w.seasonWorkId === seasonWorkId 
						? { ...w, editions: w.editions.filter(e => e.workEditionId !== workEditionId) }
						: w
				)
			};
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove edition';
		} finally {
			removingEditionId = null;
		}
	}

	async function setPrimaryEdition(seasonWorkId: string, workEditionId: string) {
		settingPrimaryId = workEditionId;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${data.season.id}/works/${seasonWorkId}/editions/${workEditionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isPrimary: true })
			});

			if (!response.ok) {
				throw new Error('Failed to set primary edition');
			}

			// Update local state - set this as primary, others as not
			repertoire = {
				...repertoire,
				works: repertoire.works.map(w => 
					w.seasonWorkId === seasonWorkId 
						? { 
							...w, 
							editions: w.editions.map(e => ({
								...e,
								isPrimary: e.workEditionId === workEditionId
							}))
						}
						: w
				)
			};
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to set primary edition';
		} finally {
			settingPrimaryId = null;
		}
	}

	// Convert repertoire works to sortable format (need `id` property)
	let sortableWorks = $derived(
		repertoire.works.map(w => ({
			id: w.seasonWorkId,
			...w
		}))
	);
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
							<a href="/works" class="text-blue-600 hover:underline">
								Add works to the library first
							</a>
						</p>
					{/if}
				</div>
			</Card>
		{:else}
			<SortableList 
				items={sortableWorks} 
				onReorder={handleReorderWorks}
				disabled={!data.canManageLibrary || isReordering}
			>
				{#snippet item(repWork, index)}
					{@const typedWork = repWork as unknown as SeasonRepertoireWork & { id: string }}
					{@const availableEditions = getAvailableEditionsForWork(typedWork)}
					<Card padding="md">
						<div class="flex-1">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<button
											onclick={() => toggleExpanded(typedWork.seasonWorkId)}
											class="flex items-center gap-2 text-left hover:text-blue-600"
										>
											<span class="text-gray-400 transition-transform" class:rotate-90={expandedWorkId === typedWork.seasonWorkId}>
												▶
											</span>
											<h3 class="font-medium">{typedWork.work.title}</h3>
										</button>
										{#if typedWork.work.composer}
											<p class="ml-6 text-sm text-gray-600">{typedWork.work.composer}</p>
										{/if}
										
										<!-- Notes display/edit -->
										{#if editingNotesFor === typedWork.seasonWorkId}
											<div class="ml-6 mt-2 flex gap-2">
												<input
													type="text"
													bind:value={notesInput}
													placeholder="Add a note..."
													class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
												/>
												<button
													onclick={() => saveNotes(typedWork.seasonWorkId)}
													disabled={savingNotes}
													class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
												>
													{savingNotes ? '...' : 'Save'}
												</button>
												<button
													onclick={cancelEditingNotes}
													class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
												>
													Cancel
												</button>
											</div>
										{:else if typedWork.notes}
											<p class="ml-6 mt-1 text-sm italic text-gray-500">
												{typedWork.notes}
												{#if data.canManageLibrary}
													<button
														onclick={() => startEditingNotes(typedWork)}
														class="ml-1 text-blue-600 hover:underline"
													>
														edit
													</button>
												{/if}
											</p>
										{:else if data.canManageLibrary}
											<button
												onclick={() => startEditingNotes(typedWork)}
												class="ml-6 mt-1 text-xs text-gray-400 hover:text-blue-600"
											>
												+ Add note
											</button>
										{/if}
										
										<!-- Editions summary -->
										<div class="ml-6 mt-1 text-xs text-gray-500">
											{#if typedWork.editions.length === 0}
												<span class="text-amber-600">No editions selected</span>
											{:else if typedWork.editions.length === 1}
												<span>1 edition</span>
											{:else}
												<span>{typedWork.editions.length} editions</span>
											{/if}
										</div>
									</div>

									{#if data.canManageLibrary}
										<button
											onclick={() => removeWorkFromSeason(typedWork.seasonWorkId, typedWork.work.id)}
											disabled={removingWorkId === typedWork.seasonWorkId}
											class="text-red-600 hover:text-red-800 disabled:opacity-50"
											title="Remove from repertoire"
										>
											{removingWorkId === typedWork.seasonWorkId ? '...' : '✕'}
										</button>
									{/if}
								</div>

								<!-- Expanded editions list -->
								{#if expandedWorkId === typedWork.seasonWorkId}
									<div class="ml-6 mt-4 border-t pt-4">
										<h4 class="mb-2 text-sm font-medium text-gray-700">Editions:</h4>
										
										<!-- Add edition dropdown -->
										{#if data.canManageLibrary && availableEditions.length > 0}
											<div class="mb-3 flex gap-2">
												<select
													bind:value={selectedEditionId}
													class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
													disabled={addingEditionTo === typedWork.seasonWorkId}
												>
													<option value="">Select edition to add...</option>
													{#each availableEditions as edition (edition.id)}
														<option value={edition.id}>
															{edition.name}{edition.voicing ? ` (${edition.voicing})` : ''}
														</option>
													{/each}
												</select>
												<button
													onclick={() => addEditionToWork(typedWork.seasonWorkId)}
													disabled={!selectedEditionId || addingEditionTo === typedWork.seasonWorkId}
													class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
												>
													{addingEditionTo === typedWork.seasonWorkId ? '...' : 'Add'}
												</button>
											</div>
										{/if}
										
										{#if typedWork.editions.length === 0}
											<p class="text-sm text-gray-500">
												No editions selected.
												{#if availableEditions.length === 0}
													<a href="/works/{typedWork.work.id}" class="text-blue-600 hover:underline">
														Add editions to this work first
													</a>
												{/if}
											</p>
										{:else}
											<ul class="space-y-2">
												{#each typedWork.editions as ed (ed.workEditionId)}
													{@const badge = getLicenseBadge(ed.edition.licenseType)}
													<li class="flex items-center gap-2 text-sm">
														<!-- Primary star toggle -->
														{#if data.canManageLibrary}
															<button
																onclick={() => setPrimaryEdition(typedWork.seasonWorkId, ed.workEditionId)}
																disabled={settingPrimaryId === ed.workEditionId || ed.isPrimary}
																class="transition-colors disabled:cursor-default {ed.isPrimary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}"
																title={ed.isPrimary ? 'Primary edition' : 'Set as primary'}
															>
																{settingPrimaryId === ed.workEditionId ? '...' : (ed.isPrimary ? '★' : '☆')}
															</button>
														{:else}
															<span class={ed.isPrimary ? 'text-amber-500' : 'text-gray-300'}>
																{ed.isPrimary ? '★' : '☆'}
															</span>
														{/if}
														
														<a 
															href="/editions/{ed.edition.id}" 
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
														
														<!-- Remove edition button -->
														{#if data.canManageLibrary}
															<button
																onclick={() => removeEditionFromWork(typedWork.seasonWorkId, ed.workEditionId)}
																disabled={removingEditionId === ed.workEditionId}
																class="ml-auto text-red-500 hover:text-red-700 disabled:opacity-50"
																title="Remove edition"
															>
																{removingEditionId === ed.workEditionId ? '...' : '×'}
															</button>
														{/if}
													</li>
												{/each}
											</ul>
										{/if}
									</div>
								{/if}
							</div>
					</Card>
				{/snippet}
			</SortableList>

			<p class="mt-4 text-sm text-gray-500">
				{repertoire.works.length} work{repertoire.works.length === 1 ? '' : 's'} in repertoire
			</p>
		{/if}
	</section>

	<!-- Events in this season -->
	<section id="events">
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
				{#each data.events as event, index (event.id)}
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
					<div id={index === 0 ? 'event-first' : index === data.events.length - 1 ? 'event-last' : undefined}>
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
				{data.events.length} event{data.events.length === 1 ? '' : 's'} in this season
			</p>
		{/if}
	</section>
</div>
