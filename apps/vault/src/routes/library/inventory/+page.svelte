<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Calculate totals
	const totals = $derived({
		copies: data.summaries.reduce((sum, s) => sum + s.total, 0),
		available: data.summaries.reduce((sum, s) => sum + s.available, 0),
		assigned: data.summaries.reduce((sum, s) => sum + s.assigned, 0),
		lost: data.summaries.reduce((sum, s) => sum + s.lost, 0)
	});
</script>

<svelte:head>
	<title>{m.library_inventory_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8 flex items-start justify-between">
		<div>
			<nav class="mb-4 text-sm text-gray-500">
				<a href="/works" class="hover:text-blue-600">{m.library_breadcrumb()}</a>
				<span class="mx-2">›</span>
				<span>Inventory</span>
			</nav>
			<h1 class="text-3xl font-bold">{m.library_inventory_title()}</h1>
			<p class="mt-2 text-gray-600">{m.library_inventory_description()}</p>
		</div>
		<div class="flex gap-3">
			<a
				href="/library/reports/collection"
				class="rounded-lg border border-amber-600 px-4 py-2 text-amber-600 transition hover:bg-amber-50"
			>
				{m.library_collection_reminders_btn()}
			</a>
			<a
				href="/library/reports/missing-copies"
				class="rounded-lg bg-amber-600 px-4 py-2 text-white transition hover:bg-amber-700"
			>
				{m.library_missing_copies_btn()}
			</a>
		</div>
	</div>

	<!-- Summary Stats -->
	<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
		<Card>
			<div class="text-center">
				<div class="text-3xl font-bold text-gray-900">{totals.copies}</div>
				<div class="text-sm text-gray-500">{m.library_stats_total()}</div>
			</div>
		</Card>
		<Card>
			<div class="text-center">
				<div class="text-3xl font-bold text-green-600">{totals.available}</div>
				<div class="text-sm text-gray-500">{m.library_stats_available()}</div>
			</div>
		</Card>
		<Card>
			<div class="text-center">
				<div class="text-3xl font-bold text-blue-600">{totals.assigned}</div>
				<div class="text-sm text-gray-500">{m.library_stats_assigned()}</div>
			</div>
		</Card>
		<Card>
			<div class="text-center">
				<div class="text-3xl font-bold text-red-600">{totals.lost}</div>
				<div class="text-sm text-gray-500">{m.library_stats_lost()}</div>
			</div>
		</Card>
	</div>

	<!-- Inventory Table -->
	<Card>
		{#if data.summaries.length === 0}
			<div class="py-12 text-center text-gray-500">
				<p>{m.library_empty()}</p>
				<p class="mt-2 text-sm">
					{m.library_empty_help()}
				</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm font-medium text-gray-500">
							<th class="pb-3 pr-4">{m.library_table_work()}</th>
							<th class="pb-3 pr-4">{m.library_table_edition()}</th>
							<th class="pb-3 pr-4 text-right">{m.library_table_total()}</th>
							<th class="pb-3 pr-4 text-right">{m.library_stats_available()}</th>
							<th class="pb-3 pr-4 text-right">{m.library_stats_assigned()}</th>
							<th class="pb-3 text-right">{m.library_stats_lost()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.summaries as summary}
							<tr class="border-b last:border-0 hover:bg-gray-50">
								<td class="py-3 pr-4">
									<div class="font-medium text-gray-900">{summary.workTitle}</div>
									{#if summary.composer}
										<div class="text-sm text-gray-500">{summary.composer}</div>
									{/if}
								</td>
								<td class="py-3 pr-4">
									<a
										href="/editions/{summary.editionId}"
										class="text-blue-600 hover:underline"
									>
										{summary.editionName}
									</a>
								</td>
								<td class="py-3 pr-4 text-right font-medium">{summary.total}</td>
								<td class="py-3 pr-4 text-right">
									{#if summary.available > 0}
										<span class="rounded-full bg-green-100 px-2 py-1 text-sm font-medium text-green-800">
											{summary.available}
										</span>
									{:else}
										<span class="text-gray-400">0</span>
									{/if}
								</td>
								<td class="py-3 pr-4 text-right">
									{#if summary.assigned > 0}
										<span class="rounded-full bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
											{summary.assigned}
										</span>
									{:else}
										<span class="text-gray-400">0</span>
									{/if}
								</td>
								<td class="py-3 text-right">
									{#if summary.lost > 0}
										<span class="rounded-full bg-red-100 px-2 py-1 text-sm font-medium text-red-800">
											{summary.lost}
										</span>
									{:else}
										<span class="text-gray-400">0</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
