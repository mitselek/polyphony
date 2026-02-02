<script lang="ts">
	/**
	 * Season navigation component for switching between seasons.
	 * Used on:
	 * - /events page (navigate between season events)
	 * - /seasons/[id] page (navigate between season details)
	 */

	interface SeasonLink {
		id: string;
		name: string;
	}

	interface Props {
		currentSeasonName: string;
		prev: SeasonLink | null;
		next: SeasonLink | null;
		/** Base path for links (e.g., '/events' or '/seasons') */
		basePath: string;
		/** Query param name for season ID (default: 'seasonId') */
		paramName?: string;
	}

	let { 
		currentSeasonName, 
		prev, 
		next, 
		basePath,
		paramName = 'seasonId'
	}: Props = $props();

	// Build link URL - uses param for /events, path for /seasons
	function buildLink(seasonId: string): string {
		if (basePath === '/seasons') {
			return `/seasons/${seasonId}`;
		}
		return `${basePath}?${paramName}=${seasonId}`;
	}
</script>

{#if prev || next}
	<div class="mb-6 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
		<div>
			{#if prev}
				<a
					href={buildLink(prev.id)}
					class="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
				>
					<span>←</span>
					<span>{prev.name}</span>
				</a>
			{:else}
				<span class="text-sm text-gray-400">← No older season</span>
			{/if}
		</div>
		<div class="text-sm font-medium text-gray-700">
			{currentSeasonName}
		</div>
		<div>
			{#if next}
				<a
					href={buildLink(next.id)}
					class="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
				>
					<span>{next.name}</span>
					<span>→</span>
				</a>
			{:else}
				<span class="text-sm text-gray-400">No newer season →</span>
			{/if}
		</div>
	</div>
{/if}
