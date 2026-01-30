<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	/**
	 * Material info for a single edition
	 */
	interface EventMaterial {
		work: {
			id: string;
			title: string;
			composer: string | null;
		};
		edition: {
			id: string;
			name: string;
			isPrimary: boolean;
		};
		assignedCopy: {
			id: string;
			copyNumber: string;
			condition: string;
			assignedAt: string;
		} | null;
		hasDigitalFile: boolean;
		needsCopy: boolean;
	}

	interface EventMaterials {
		eventId: string;
		memberId: string;
		materials: EventMaterial[];
		summary: {
			totalWorks: number;
			totalEditions: number;
			copiesAssigned: number;
			digitalAvailable: number;
			warningCount: number;
		};
	}

	interface Props {
		materials: EventMaterials;
		eventId: string;
	}

	let { materials, eventId }: Props = $props();

	// Group materials by work for display
	let materialsByWork = $derived(() => {
		const grouped = new Map<string, { work: EventMaterial['work']; editions: EventMaterial[] }>();
		
		for (const material of materials.materials) {
			const workId = material.work.id;
			if (!grouped.has(workId)) {
				grouped.set(workId, { work: material.work, editions: [] });
			}
			grouped.get(workId)!.editions.push(material);
		}
		
		return Array.from(grouped.values());
	});
</script>

<Card variant="static" padding="lg">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-semibold">What to Bring</h2>
		{#if materials.summary.warningCount > 0}
			<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
				</svg>
				{materials.summary.warningCount} {materials.summary.warningCount === 1 ? 'copy needed' : 'copies needed'}
			</span>
		{/if}
	</div>

	{#if materials.materials.length === 0}
		<p class="text-gray-500 text-sm">No materials assigned to this event yet.</p>
	{:else}
		<div class="space-y-4">
			{#each materialsByWork() as { work, editions } (work.id)}
				<div class="border-l-4 border-blue-200 pl-4">
					<h3 class="font-medium text-gray-900">
						{work.title}
						{#if work.composer}
							<span class="font-normal text-gray-500">— {work.composer}</span>
						{/if}
					</h3>
					
					<div class="mt-2 space-y-2">
						{#each editions as material (material.edition.id)}
							<div class="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
								<div class="flex items-center gap-2">
									{#if material.edition.isPrimary}
										<span class="text-amber-500" title="Primary edition">★</span>
									{/if}
									<span class="text-gray-700">{material.edition.name}</span>
								</div>
								
								<div class="flex items-center gap-3">
									<!-- Copy assignment status -->
									{#if material.assignedCopy}
										<span class="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" title="Assigned to you">
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
											</svg>
											Copy #{material.assignedCopy.copyNumber}
										</span>
									{:else if material.needsCopy}
										<span class="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title="You need a copy">
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
											</svg>
											Need copy
										</span>
									{/if}
									
									<!-- Digital download link -->
									{#if material.hasDigitalFile}
										<a 
											href="/api/editions/{material.edition.id}/download"
											class="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-200 transition"
											title="Download PDF"
										>
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
											</svg>
											PDF
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Summary footer -->
		<div class="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-500">
			<span>{materials.summary.totalWorks} {materials.summary.totalWorks === 1 ? 'work' : 'works'}</span>
			<span>•</span>
			<span>{materials.summary.totalEditions} {materials.summary.totalEditions === 1 ? 'edition' : 'editions'}</span>
			{#if materials.summary.copiesAssigned > 0}
				<span>•</span>
				<span class="text-green-600">{materials.summary.copiesAssigned} assigned</span>
			{/if}
			{#if materials.summary.digitalAvailable > 0}
				<span>•</span>
				<span class="text-blue-600">{materials.summary.digitalAvailable} downloadable</span>
			{/if}
		</div>
	{/if}
</Card>
