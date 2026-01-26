<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local state for program editor
	let program = $state([...data.program]);
	let availableScores = $state(data.allScores.filter((s: any) => !program.some(p => p.score_id === s.id)));
	let selectedScoreId = $state('');
	let addingScore = $state(false);
	let removingScoreId = $state<string | null>(null);
	let reorderingProgram = $state(false);
	let error = $state('');
	let editingEventId = $state<string | null>(null);
	let editForm = $state({
		title: data.event.title,
		description: data.event.description || '',
		location: data.event.location || '',
		event_type: data.event.event_type
	});
	let updatingEvent = $state(false);
	let deletingEvent = $state(false);

	// Format date and time
	function formatDateTime(dateString: string): string {
		const dt = new Date(dateString);
		return dt.toLocaleString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
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
			case 'rehearsal':
				return 'bg-blue-100 text-blue-700 border-blue-300';
			case 'concert':
				return 'bg-purple-100 text-purple-700 border-purple-300';
			case 'retreat':
				return 'bg-green-100 text-green-700 border-green-300';
			default:
				return 'bg-gray-100 text-gray-700 border-gray-300';
		}
	}

	// Find score by ID
	function getScoreById(scoreId: string) {
		return data.allScores.find((s: any) => s.id === scoreId);
	}

	// Toggle edit mode
	function startEditEvent() {
		editingEventId = data.event.id;
		editForm = {
			title: data.event.title,
			description: data.event.description || '',
			location: data.event.location || '',
			event_type: data.event.event_type
		};
	}

	function cancelEditEvent() {
		editingEventId = null;
		error = '';
	}

	// Update event
	async function saveEvent() {
		updatingEvent = true;
		error = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editForm)
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				throw new Error(errorData.message || 'Failed to update event');
			}

			const updated = await response.json() as any;
			
			// Update local state
			data.event.title = updated.title;
			data.event.description = updated.description;
			data.event.location = updated.location;
			data.event.event_type = updated.event_type;
			
			editingEventId = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update event';
			setTimeout(() => error = '', 5000);
		} finally {
			updatingEvent = false;
		}
	}

	// Delete event
	async function deleteEvent() {
		const confirmed = confirm(
			`Are you sure you want to delete "${data.event.title}"?\n\nThis will also remove all program entries. This action cannot be undone.`
		);

		if (!confirmed) return;

		deletingEvent = true;
		error = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				throw new Error(errorData.message || 'Failed to delete event');
			}

			// Redirect to events list
			goto('/events');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete event';
			setTimeout(() => error = '', 5000);
			deletingEvent = false;
		}
	}

	// Add score to program
	async function addToProgram() {
		if (!selectedScoreId) return;

		addingScore = true;
		error = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}/program`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					score_id: selectedScoreId,
					position: program.length
				})
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				throw new Error(errorData.message || 'Failed to add score to program');
			}

			// Reload program
			const updatedProgram = await response.json() as any;
			program = updatedProgram;
			
			// Update available scores
			availableScores = data.allScores.filter((s: any) => !program.some(p => p.score_id === s.id));
			selectedScoreId = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add score';
			setTimeout(() => error = '', 5000);
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
		error = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}/program/${scoreId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				throw new Error(errorData.message || 'Failed to remove score');
			}

			// Update local state
			program = program.filter(p => p.score_id !== scoreId);
			
			// Update available scores
			availableScores = data.allScores.filter((s: any) => !program.some(p => p.score_id === s.id));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove score';
			setTimeout(() => error = '', 5000);
		} finally {
			removingScoreId = null;
		}
	}

	// Reorder program (drag and drop)
	function moveUp(index: number) {
		if (index === 0) return;
		const newProgram = [...program];
		[newProgram[index - 1], newProgram[index]] = [newProgram[index], newProgram[index - 1]];
		program = newProgram;
		saveReorder();
	}

	function moveDown(index: number) {
		if (index === program.length - 1) return;
		const newProgram = [...program];
		[newProgram[index], newProgram[index + 1]] = [newProgram[index + 1], newProgram[index]];
		program = newProgram;
		saveReorder();
	}

	async function saveReorder() {
		reorderingProgram = true;
		error = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}/program/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					score_ids: program.map(p => p.score_id)
				})
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				throw new Error(errorData.message || 'Failed to reorder program');
			}

			// Program successfully reordered
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reorder program';
			setTimeout(() => error = '', 5000);
		} finally {
			reorderingProgram = false;
		}
	}
</script>

<svelte:head>
	<title>{data.event.title} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<!-- Back Button -->
	<div class="mb-6">
		<a href="/events" class="inline-flex items-center text-blue-600 hover:text-blue-800">
			<svg class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
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
				<div>
					<label for="edit-description" class="block text-sm font-medium text-gray-700">Description</label>
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
						{updatingEvent ? 'Saving...' : 'Save Changes'}
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
						<span class="inline-block rounded-full border px-3 py-1 text-xs font-medium {getEventTypeColor(data.event.event_type)}">
							{data.event.event_type}
						</span>
					</div>

					<!-- Title -->
					<h1 class="mb-2 text-3xl font-bold text-gray-900">{data.event.title}</h1>

					<!-- Date and Time -->
					<div class="mb-4 text-gray-600">
						<div class="flex items-center gap-2">
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							<span>{formatDateTime(data.event.starts_at)}</span>
						</div>
						<div class="ml-7 text-sm text-gray-500">
						Duration: {formatDuration(data.event.starts_at, data.event.ends_at || data.event.starts_at)}
						</div>
					</div>

					<!-- Location -->
					{#if data.event.location}
						<div class="mb-4 flex items-center gap-2 text-gray-600">
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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
							{deletingEvent ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Program (Setlist) Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Program</h2>
			{#if data.canManage && program.length > 0}
				<span class="text-sm text-gray-500">{program.length} piece{program.length !== 1 ? 's' : ''}</span>
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
						<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
							<!-- Position -->
							<div class="flex-shrink-0 text-2xl font-bold text-gray-400">
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
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										</svg>
									</button>
									<button
										onclick={() => moveDown(index)}
										disabled={index === program.length - 1 || reorderingProgram}
										class="rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
										title="Move down"
									>
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									<button
										onclick={() => removeFromProgram(entry.score_id)}
										disabled={removingScoreId === entry.score_id}
										class="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
										title="Remove from program"
									>
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
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
					<p class="text-sm text-gray-500">All scores have been added to the program.</p>
				{:else}
					<div class="flex gap-2">
						<select
							bind:value={selectedScoreId}
							class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
						>
							<option value="">Select a score...</option>
							{#each availableScores as score (score.id)}
								<option value={score.id}>
									{score.title}{score.composer ? ` - ${score.composer}` : ''}
								</option>
							{/each}
						</select>
						<button
							onclick={addToProgram}
							disabled={!selectedScoreId || addingScore}
							class="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{addingScore ? 'Adding...' : 'Add'}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
