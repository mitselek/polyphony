<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import SeasonRepertoireCard from '$lib/components/SeasonRepertoireCard.svelte';
	import SeasonEventsCard from '$lib/components/SeasonEventsCard.svelte';
	import SeasonNavigation from '$lib/components/SeasonNavigation.svelte';
	import type { SeasonRepertoire, Work } from '$lib/types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Local state for repertoire (reactive copy)
	let repertoire: SeasonRepertoire = $state(untrack(() => data.repertoire));
	let availableWorks: Work[] = $state(untrack(() => data.availableWorks));

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
</script>

<svelte:head>
	<title>{data.season.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">

	<!-- Season Navigation -->
	<SeasonNavigation
		currentSeasonName={data.season.name}
		prev={data.seasonNav.prev}
		next={data.seasonNav.next}
		basePath="/seasons"
	/>

	<div class="mb-8">
		<h1 class="text-3xl font-bold">{data.season.name}</h1>
		<p class="mt-1 text-gray-600">
			{m.season_starts()}: {new Date(data.season.start_date + 'T00:00:00').toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})}
		</p>
	</div>

	<!-- Repertoire Section -->
	<SeasonRepertoireCard
		seasonId={data.season.id}
		bind:repertoire
		bind:availableWorks
		workEditionsMap={data.workEditionsMap}
		canManageLibrary={data.canManageLibrary}
		onRepertoireChange={handleRepertoireChange}
		onAvailableWorksChange={handleAvailableWorksChange}
	/>

	<!-- Events in this season -->
	<SeasonEventsCard
		seasonId={data.season.id}
		events={data.events}
		canManage={data.canManage}
	/>
</div>
