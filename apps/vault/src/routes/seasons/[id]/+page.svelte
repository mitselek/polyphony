<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import SeasonRepertoireCard from '$lib/components/SeasonRepertoireCard.svelte';
	import SeasonEventsCard from '$lib/components/SeasonEventsCard.svelte';
	import type { SeasonRepertoire, Work } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Local state for repertoire (reactive copy)
	let repertoire: SeasonRepertoire = $state(untrack(() => data.repertoire));
	let availableWorks: Work[] = $state(untrack(() => data.availableWorks));
	
	// Error state
	let error = $state('');

	// Sync on navigation
	$effect(() => {
		repertoire = data.repertoire;
		availableWorks = data.availableWorks;
	});

	function handleRepertoireChange(newRepertoire: SeasonRepertoire) {
		repertoire = newRepertoire;
	}

	function handleAvailableWorksChange(newWorks: Work[]) {
		availableWorks = newWorks;
	}

	function handleError(message: string) {
		error = message;
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
	<SeasonRepertoireCard
		seasonId={data.season.id}
		bind:repertoire
		bind:availableWorks
		workEditionsMap={data.workEditionsMap}
		canManageLibrary={data.canManageLibrary}
		onRepertoireChange={handleRepertoireChange}
		onAvailableWorksChange={handleAvailableWorksChange}
		onError={handleError}
	/>

	<!-- Events in this season -->
	<SeasonEventsCard
		seasonId={data.season.id}
		events={data.events}
		canManage={data.canManage}
	/>
</div>
