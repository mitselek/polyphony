<script lang="ts">
	import type { PageData } from './$types';

	interface Score {
		id: string;
		title: string;
		composer: string | null;
		arranger: string | null;
		license_type: string;
		uploaded_at: string;
	}

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');

	let filteredScores = $derived(
		data.scores.filter(
			(s: Score) =>
				s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(s.composer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
		)
	);
</script>

<svelte:head>
	<title>Library | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Score Library</h1>
		<a
			href="/upload"
			class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>
			Upload Score
		</a>
	</div>

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search by title or composer..."
			class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
		/>
	</div>

	<!-- Score List -->
	{#if filteredScores.length === 0}
		<div class="py-12 text-center text-gray-500">
			{#if data.scores.length === 0}
				<p class="text-lg">No scores yet.</p>
				<p class="mt-2">
					<a href="/upload" class="text-blue-600 hover:underline">Upload your first score</a>
				</p>
			{:else}
				<p>No scores match your search.</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredScores as score}
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
				>
					<div>
						<h2 class="text-lg font-semibold">{score.title}</h2>
						{#if score.composer}
							<p class="text-gray-600">{score.composer}</p>
						{/if}
						{#if score.arranger}
							<p class="text-sm text-gray-500">arr. {score.arranger}</p>
						{/if}
						<p class="mt-1 text-xs text-gray-400">
							{new Date(score.uploaded_at).toLocaleDateString()}
						</p>
					</div>
					<button
						onclick={() => window.location.href = `/api/scores/${score.id}/download`}
						class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
					>
						Download
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<p class="mt-6 text-sm text-gray-500">
		{filteredScores.length} of {data.scores.length} scores
	</p>
</div>
