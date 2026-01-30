<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	interface ProgramEntry {
		event_id: string;
		edition_id: string;
		position: number;
		notes: string | null;
		added_at: string;
	}

	interface Score {
		id: string;
		workTitle: string;
		workComposer: string | null;
		name: string;
	}

	interface Props {
		eventId: string;
		program: ProgramEntry[];
		allEditions: Score[];
		canManage: boolean;
		onUpdate?: () => void;
	}

	let { eventId, program = $bindable(), allEditions, canManage, onUpdate }: Props = $props();

	// Local state
	let error = $state('');
	let selectedScoreId = $state('');
	let addingScore = $state(false);
	let removingScoreId = $state<string | null>(null);
	let reorderingProgram = $state(false);

	// Derived: available scores are all editions not already in program
	let availableScores = $derived(allEditions.filter((s) => !program.some((p) => p.edition_id === s.id)));
	let canAddScore = $derived(!!selectedScoreId && !addingScore);

	function getScoreById(editionId: string): Score | undefined {
		return allEditions.find((s) => s.id === editionId);
	}

	async function addToProgram() {
		if (!selectedScoreId || addingScore) return;

		addingScore = true;
		error = '';

		try {
			const response = await fetch(`/api/events/${eventId}/program`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edition_id: selectedScoreId })
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { message?: string };
				throw new Error(errorData.message || 'Failed to add score');
			}

			// Server returns the updated program, just use the response
			const updatedProgram = (await response.json()) as ProgramEntry[];
			program = updatedProgram;

			// availableScores is $derived - updates automatically when program changes
			selectedScoreId = '';
			onUpdate?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add score';
			setTimeout(() => (error = ''), 5000);
		} finally {
			addingScore = false;
		}
	}

	async function removeFromProgram(editionId: string) {
		removingScoreId = editionId;
		error = '';

		try {
			const response = await fetch(`/api/events/${eventId}/program/${editionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { message?: string };
				throw new Error(errorData.message || 'Failed to remove score');
			}

			// Update local state - availableScores updates automatically via $derived
			program = program.filter((p) => p.edition_id !== editionId);
			onUpdate?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove score';
			setTimeout(() => (error = ''), 5000);
		} finally {
			removingScoreId = null;
		}
	}

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
			const response = await fetch(`/api/events/${eventId}/program/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					edition_ids: program.map((p) => p.edition_id)
				})
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { message?: string };
				throw new Error(errorData.message || 'Failed to reorder program');
			}
			onUpdate?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reorder program';
			setTimeout(() => (error = ''), 5000);
		} finally {
			reorderingProgram = false;
		}
	}
</script>

<Card padding="lg">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-semibold">Program</h2>
		{#if canManage && program.length > 0}
			<span class="text-sm text-gray-500">
				{program.length} piece{program.length !== 1 ? 's' : ''}
			</span>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>
	{/if}

	{#if program.length === 0}
		<div class="py-8 text-center text-gray-500">
			<p>No scores in the program yet.</p>
			{#if canManage}
				<p class="mt-2 text-sm">Add scores below to build the program.</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			{#each program as entry, index (entry.edition_id)}
				{@const score = getScoreById(entry.edition_id)}
				{#if score}
					<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
						<!-- Position -->
						<div class="shrink-0 text-2xl font-bold text-gray-400">
							{index + 1}
						</div>

						<!-- Score Details -->
						<div class="flex-1">
							<h3 class="font-semibold text-gray-900">{score.workTitle}</h3>
							{#if score.workComposer}
								<p class="text-sm text-gray-600">{score.workComposer}</p>
							{/if}
							{#if entry.notes}
								<p class="mt-1 text-sm italic text-gray-500">{entry.notes}</p>
							{/if}
						</div>

						<!-- Actions -->
						{#if canManage}
							<div class="flex gap-1">
								<button
									onclick={() => moveUp(index)}
									disabled={index === 0 || reorderingProgram}
									class="rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
									title="Move up"
								>
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 15l7-7 7 7"
										/>
									</svg>
								</button>
								<button
									onclick={() => moveDown(index)}
									disabled={index === program.length - 1 || reorderingProgram}
									class="rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
									title="Move down"
								>
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>
								<button
									onclick={() => removeFromProgram(entry.edition_id)}
									disabled={removingScoreId === entry.edition_id}
									class="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
									title="Remove from program"
								>
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
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
	{#if canManage}
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
								{score.workTitle}{score.workComposer ? ` - ${score.workComposer}` : ''}
							</option>
						{/each}
					</select>
					<button
						onclick={addToProgram}
						disabled={!canAddScore}
						class="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
					>
						{addingScore ? 'Adding...' : 'Add'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</Card>
