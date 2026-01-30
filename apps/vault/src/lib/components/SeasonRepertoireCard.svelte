<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import type { SeasonRepertoireWork, SeasonRepertoire, Work, Edition } from '$lib/types';
	import { getLicenseBadge } from '$lib/utils/badges';

	interface Props {
		seasonId: string;
		repertoire: SeasonRepertoire;
		availableWorks: Work[];
		workEditionsMap: Record<string, Edition[]>;
		canManageLibrary: boolean;
		onRepertoireChange: (repertoire: SeasonRepertoire) => void;
		onAvailableWorksChange: (works: Work[]) => void;
		onError: (message: string) => void;
	}

	let {
		seasonId,
		repertoire = $bindable(),
		availableWorks = $bindable(),
		workEditionsMap,
		canManageLibrary,
		onRepertoireChange,
		onAvailableWorksChange,
		onError
	}: Props = $props();

	// State for UI interactions
	let selectedWorkId = $state('');
	let addingWork = $state(false);
	let removingWorkId = $state<string | null>(null);
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

	// ============================================================================
	// WORK OPERATIONS
	// ============================================================================

	async function addWorkToSeason() {
		if (!selectedWorkId) return;

		addingWork = true;

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workId: selectedWorkId })
			});

			if (!response.ok) {
				const result = await response.json() as { error?: string };
				throw new Error(result.error ?? 'Failed to add work');
			}

			// Refresh repertoire
			const repertoireResponse = await fetch(`/api/seasons/${seasonId}/works`);
			if (repertoireResponse.ok) {
				const newRepertoire = await repertoireResponse.json() as SeasonRepertoire;
				repertoire = newRepertoire;
				onRepertoireChange(newRepertoire);
			}

			// Update available works
			const newAvailableWorks = availableWorks.filter(w => w.id !== selectedWorkId);
			availableWorks = newAvailableWorks;
			onAvailableWorksChange(newAvailableWorks);
			selectedWorkId = '';
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to add work');
		} finally {
			addingWork = false;
		}
	}

	async function removeWorkFromSeason(seasonWorkId: string, workId: string) {
		if (!confirm('Remove this work from the season repertoire?')) return;

		removingWorkId = seasonWorkId;

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/${seasonWorkId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove work');
			}

			// Update local state
			const removedWork = repertoire.works.find(w => w.seasonWorkId === seasonWorkId);
			const newRepertoire = { ...repertoire, works: repertoire.works.filter(w => w.seasonWorkId !== seasonWorkId) };
			repertoire = newRepertoire;
			onRepertoireChange(newRepertoire);
			
			// Add back to available works
			if (removedWork) {
				const newAvailableWorks = [...availableWorks, removedWork.work].sort((a, b) => a.title.localeCompare(b.title));
				availableWorks = newAvailableWorks;
				onAvailableWorksChange(newAvailableWorks);
			}
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to remove work');
		} finally {
			removingWorkId = null;
		}
	}

	async function handleReorderWorks(newOrder: string[]) {
		isReordering = true;

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/reorder`, {
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
			const newRepertoire = { ...repertoire, works: reorderedWorks };
			repertoire = newRepertoire;
			onRepertoireChange(newRepertoire);
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to reorder works');
			// Refresh to get correct order
			const repertoireResponse = await fetch(`/api/seasons/${seasonId}/works`);
			if (repertoireResponse.ok) {
				const refreshedRepertoire = await repertoireResponse.json() as SeasonRepertoire;
				repertoire = refreshedRepertoire;
				onRepertoireChange(refreshedRepertoire);
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

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/${seasonWorkId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: notesInput.trim() || null })
			});

			if (!response.ok) {
				throw new Error('Failed to save notes');
			}

			// Update local state
			const newRepertoire = {
				...repertoire,
				works: repertoire.works.map(w => 
					w.seasonWorkId === seasonWorkId 
						? { ...w, notes: notesInput.trim() || null }
						: w
				)
			};
			repertoire = newRepertoire;
			onRepertoireChange(newRepertoire);
			editingNotesFor = null;
			notesInput = '';
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to save notes');
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

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/${seasonWorkId}/editions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ editionId: selectedEditionId })
			});

			if (!response.ok) {
				const result = await response.json() as { error?: string };
				throw new Error(result.error ?? 'Failed to add edition');
			}

			// Refresh repertoire to get updated editions
			const repertoireResponse = await fetch(`/api/seasons/${seasonId}/works`);
			if (repertoireResponse.ok) {
				const newRepertoire = await repertoireResponse.json() as SeasonRepertoire;
				repertoire = newRepertoire;
				onRepertoireChange(newRepertoire);
			}
			selectedEditionId = '';
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to add edition');
		} finally {
			addingEditionTo = null;
		}
	}

	async function removeEditionFromWork(seasonWorkId: string, workEditionId: string) {
		removingEditionId = workEditionId;

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/${seasonWorkId}/editions/${workEditionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove edition');
			}

			// Update local state
			const newRepertoire = {
				...repertoire,
				works: repertoire.works.map(w => 
					w.seasonWorkId === seasonWorkId 
						? { ...w, editions: w.editions.filter(e => e.workEditionId !== workEditionId) }
						: w
				)
			};
			repertoire = newRepertoire;
			onRepertoireChange(newRepertoire);
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to remove edition');
		} finally {
			removingEditionId = null;
		}
	}

	async function setPrimaryEdition(seasonWorkId: string, workEditionId: string) {
		settingPrimaryId = workEditionId;

		try {
			const response = await fetch(`/api/seasons/${seasonId}/works/${seasonWorkId}/editions/${workEditionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isPrimary: true })
			});

			if (!response.ok) {
				throw new Error('Failed to set primary edition');
			}

			// Update local state - set this as primary, others as not
			const newRepertoire = {
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
			repertoire = newRepertoire;
			onRepertoireChange(newRepertoire);
		} catch (err) {
			onError(err instanceof Error ? err.message : 'Failed to set primary edition');
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

<section class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-semibold">Season Repertoire</h2>
	</div>

	{#if canManageLibrary && availableWorks.length > 0}
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
			disabled={!canManageLibrary || isReordering}
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
										{#if canManageLibrary}
											<button
												onclick={() => startEditingNotes(typedWork)}
												class="ml-1 text-blue-600 hover:underline"
											>
												edit
											</button>
										{/if}
									</p>
								{:else if canManageLibrary}
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

							{#if canManageLibrary}
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
								{#if canManageLibrary && availableEditions.length > 0}
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
												{#if canManageLibrary}
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
												{#if canManageLibrary}
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
