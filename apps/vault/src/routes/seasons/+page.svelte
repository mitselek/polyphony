<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { Season } from '$lib/server/db/seasons';
	import Modal from '$lib/components/Modal.svelte';
	import Card from '$lib/components/Card.svelte';
	import { formatDateLong } from '$lib/utils/formatters';
	import { toast } from '$lib/stores/toast';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Local state
	let seasons = $state<Season[]>(untrack(() => data.seasons));
	let showCreateForm = $state(false);
	let editingSeason = $state<Season | null>(null);
	let deletingId = $state<string | null>(null);
	let saving = $state(false);
	let error = $state('');

	// Form state
	let formName = $state('');
	let formStartDate = $state('');

	// Sync with data on navigation
	$effect(() => {
		seasons = data.seasons;
	});

	function openCreateForm() {
		formName = '';
		formStartDate = '';
		editingSeason = null;
		showCreateForm = true;
	}

	function openEditForm(season: Season) {
		formName = season.name;
		formStartDate = season.start_date;
		editingSeason = season;
		showCreateForm = true;
	}

	function closeForm() {
		showCreateForm = false;
		editingSeason = null;
		formName = '';
		formStartDate = '';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!formName.trim()) {
			error = 'Name is required';
			return;
		}

		if (!formStartDate) {
			error = 'Start date is required';
			return;
		}

		saving = true;
		error = '';

		try {
			if (editingSeason) {
				// Update existing season
				const response = await fetch(`/api/seasons/${editingSeason.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: formName.trim(),
						start_date: formStartDate
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? 'Failed to update season');
				}

				const updated = (await response.json()) as Season;
				seasons = seasons.map((s) => (s.id === updated.id ? updated : s));
				// Re-sort by start_date DESC
				seasons = [...seasons].sort(
					(a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
				);
				toast.success(`"${updated.name}" updated successfully`);
			} else {
				// Create new season
				const response = await fetch('/api/seasons', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: formName.trim(),
						start_date: formStartDate
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? 'Failed to create season');
				}

				const created = (await response.json()) as Season;
				// Insert and re-sort by start_date DESC
				seasons = [...seasons, created].sort(
					(a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
				);
				toast.success(`"${created.name}" created successfully`);
			}

			closeForm();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
		} finally {
			saving = false;
		}
	}

	async function deleteSeason(season: Season) {
		if (!confirm(`Delete "${season.name}"? This cannot be undone.`)) return;

		deletingId = season.id;
		error = '';

		try {
			const response = await fetch(`/api/seasons/${season.id}`, { method: 'DELETE' });

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to delete season');
			}

			seasons = seasons.filter((s) => s.id !== season.id);
			toast.success(`"${season.name}" deleted`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Delete failed';
		} finally {
			deletingId = null;
		}
	}

	function getSeasonEndDate(season: Season, index: number): string | null {
		// The end date is the day before the next season's start
		// (or null if this is the most recent season)
		if (index === 0) return null; // Most recent season has no end

		const prevSeasonStart = seasons[index - 1].start_date;
		const endDate = new Date(prevSeasonStart + 'T00:00:00');
		endDate.setDate(endDate.getDate() - 1);
		return endDate.toISOString().split('T')[0];
	}

	/**
	 * Check if today falls within the season's date range
	 */
	function isCurrentSeason(season: Season, index: number): boolean {
		const today = new Date().toISOString().split('T')[0];
		const startDate = season.start_date;
		const endDate = getSeasonEndDate(season, index);

		// Today must be >= start date
		if (today < startDate) return false;

		// If no end date (most recent season), today just needs to be >= start
		if (!endDate) return true;

		// Today must be <= end date
		return today <= endDate;
	}
</script>

<svelte:head>
	<title>{m.seasons_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">{m.seasons_title()}</h1>
			<p class="mt-1 text-gray-600">{m.seasons_description()}</p>
		</div>
		{#if data.canManage}
			<button
				onclick={openCreateForm}
				class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
			>
				{m.seasons_add_btn()}
			</button>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
			<button onclick={() => (error = '')} class="ml-2 text-red-900 hover:underline">×</button>
		</div>
	{/if}

	<!-- Create/Edit Form Modal -->
	<Modal
		open={showCreateForm}
		title={editingSeason ? m.season_modal_title_edit() : m.season_modal_title_add()}
		onclose={closeForm}
	>
		<form onsubmit={handleSubmit}>
			<div class="mb-4">
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
					{m.season_name_label()}
				</label>
				<input
					id="name"
					type="text"
					bind:value={formName}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					placeholder="e.g., Fall 2026"
					required
				/>
			</div>
			<div class="mb-4">
				<label for="start_date" class="mb-1 block text-sm font-medium text-gray-700">
					{m.season_start_date_label()}
				</label>
				<input
					id="start_date"
					type="date"
					bind:value={formStartDate}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					required
				/>
				<p class="mt-1 text-xs text-gray-500">
					{m.season_start_date_help()}
				</p>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<button
					type="button"
					onclick={closeForm}
					class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
				>
					{m.actions_cancel()}
				</button>
				<button
					type="submit"
					disabled={saving}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
				>
					{saving ? m.season_submit_btn_save() : editingSeason ? m.season_submit_btn_update() : m.season_submit_btn_create()}
				</button>
			</div>
		</form>
	</Modal>

	<!-- Seasons List -->
	{#if seasons.length === 0}
		<Card padding="lg">
			<div class="py-8 text-center text-gray-500">
				<p>{m.seasons_empty()}</p>
				{#if data.canManage}
					<p class="mt-2">
						<button onclick={openCreateForm} class="text-blue-600 hover:underline">
							{m.seasons_add_first()}
						</button>
					</p>
				{/if}
			</div>
		</Card>
	{:else}
		<div class="space-y-4">
			{#each seasons as season, index (season.id)}
				{@const endDate = getSeasonEndDate(season, index)}
				{@const isCurrent = isCurrentSeason(season, index)}
				<Card variant="clickable" href="/seasons/{season.id}" padding="lg">
					<div class="flex items-center justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-semibold">
									{season.name}
								</h3>
								{#if isCurrent}
									<span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
										{m.seasons_current_badge()}
									</span>
								{/if}
							</div>
							<p class="mt-1 text-sm text-gray-600">
								{formatDateLong(season.start_date)}
								{#if endDate}
									<span class="text-gray-400">→</span>
									{formatDateLong(endDate)}
								{/if}
							</p>
						</div>
						{#if data.canManage}
							{#snippet actions()}
								<div class="flex items-center gap-2">
									<button
										onclick={(e) => { e.preventDefault(); e.stopPropagation(); openEditForm(season); }}
										class="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
									>
										{m.actions_edit()}
									</button>
									<button
										onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSeason(season); }}
										disabled={deletingId === season.id}
										class="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
									>
										{deletingId === season.id ? 'Deleting...' : m.actions_delete()}
									</button>
								</div>
							{/snippet}
							{@render actions()}
						{/if}
					</div>
				</Card>
			{/each}
		</div>

		<p class="mt-6 text-sm text-gray-500">
			{seasons.length} season{seasons.length === 1 ? '' : 's'}
		</p>
	{/if}
</div>
