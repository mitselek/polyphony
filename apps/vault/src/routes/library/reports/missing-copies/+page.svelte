<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import type { MissingCopyEntry } from '$lib/server/db/inventory-reports';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Group entries by edition for display
	const entriesByEdition = $derived(() => {
		if (!data.report) return new Map<string, { edition: EditionInfo; members: MemberInfo[] }>();

		const grouped = new Map<string, { edition: EditionInfo; members: MemberInfo[] }>();

		for (const entry of data.report.entries) {
			if (!grouped.has(entry.editionId)) {
				grouped.set(entry.editionId, {
					edition: {
						id: entry.editionId,
						name: entry.editionName,
						workId: entry.workId,
						workTitle: entry.workTitle,
						composer: entry.composer
					},
					members: []
				});
			}
			grouped.get(entry.editionId)!.members.push({
				id: entry.memberId,
				name: entry.memberName,
				sectionId: entry.sectionId,
				sectionName: entry.sectionName
			});
		}

		return grouped;
	});

	interface EditionInfo {
		id: string;
		name: string;
		workId: string;
		workTitle: string;
		composer: string | null;
	}

	interface MemberInfo {
		id: string;
		name: string;
		sectionId: string;
		sectionName: string;
	}
</script>

<svelte:head>
	<title>{m.missing_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<nav class="mb-4 text-sm text-gray-500">
			<a href="/works" class="hover:text-blue-600">{m.library_breadcrumb()}</a>
			<span class="mx-2">›</span>
			<a href="/library/inventory" class="hover:text-blue-600">{m.library_inventory_title()}</a>
			<span class="mx-2">›</span>
			<span>{m.missing_breadcrumb()}</span>
		</nav>
		<h1 class="text-3xl font-bold">{m.missing_title()}</h1>
		<p class="mt-2 text-gray-600">{m.missing_description()}</p>
	</div>

	<!-- Filters -->
	<Card class="mb-6">
		<div class="flex flex-wrap gap-4">
			<!-- Event Filter -->
			<div class="flex-1 min-w-50">
				<label for="event-filter" class="mb-1 block text-sm font-medium text-gray-700">
					{m.missing_event_filter_label()}
				</label>
				<select
					id="event-filter"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					value={data.selectedEventId ?? ''}
					onchange={(e) => {
						const value = e.currentTarget.value;
						if (value) {
							window.location.href = `?event=${value}`;
						} else {
							window.location.href = window.location.pathname;
						}
					}}
				>
					<option value="">{m.missing_event_filter_placeholder()}</option>
					{#each data.events as event}
						<option value={event.id}>{event.title}</option>
					{/each}
				</select>
			</div>

			<!-- Season Filter -->
			<div class="flex-1 min-w-50">
				<label for="season-filter" class="mb-1 block text-sm font-medium text-gray-700">
					{m.missing_season_filter_label()}
				</label>
				<select
					id="season-filter"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
					value={data.selectedSeasonId ?? ''}
					onchange={(e) => {
						const value = e.currentTarget.value;
						if (value) {
							window.location.href = `?season=${value}`;
						} else {
							window.location.href = window.location.pathname;
						}
					}}
				>
					<option value="">{m.missing_season_filter_placeholder()}</option>
					{#each data.seasons as season}
						<option value={season.id}>{season.name}</option>
					{/each}
				</select>
			</div>
		</div>
	</Card>

	<!-- No Filter Selected -->
	{#if !data.report}
		<Card>
			<div class="py-12 text-center text-gray-500">
				<svg class="mx-auto mb-4 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
				</svg>
				<p class="text-lg font-medium">{m.missing_select_filter()}</p>
				<p class="mt-2 text-sm">
					{m.missing_select_filter_help()}
				</p>
			</div>
		</Card>
	{:else if data.report.totalMissing === 0}
		<!-- All Copies Assigned -->
		<Card>
			<div class="py-12 text-center">
				<svg class="mx-auto mb-4 h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="text-lg font-medium text-green-700">{m.missing_all_assigned()}</p>
				<p class="mt-2 text-sm text-gray-500">
					{m.missing_all_assigned_help()}
				</p>
			</div>
		</Card>
	{:else}
		<!-- Summary Stats -->
		<div class="mb-6 grid grid-cols-2 gap-4">
			<Card>
				<div class="text-center">
					<div class="text-3xl font-bold text-amber-600">{data.report.totalMissing}</div>
					<div class="text-sm text-gray-500">{m.missing_stats_missing()}</div>
				</div>
			</Card>
			<Card>
				<div class="text-center">
					<div class="text-3xl font-bold text-gray-900">{data.report.editionCount}</div>
					<div class="text-sm text-gray-500">{m.missing_stats_editions()}</div>
				</div>
			</Card>
		</div>

		<!-- Active Filter Badge -->
		<div class="mb-4 flex items-center gap-2">
			<span class="text-sm text-gray-500">{m.missing_showing_results()}</span>
			<span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
				{data.filterType === 'event' ? '📅' : '📆'} {data.filterName}
			</span>
			<a
				href={window.location.pathname}
				class="ml-2 text-sm text-gray-500 hover:text-gray-700"
			>
				{m.missing_clear_btn()}
			</a>
		</div>

		<!-- Grouped Results -->
		{#each [...entriesByEdition().entries()] as [editionId, group]}
			<Card class="mb-4">
				<!-- Edition Header -->
				<div class="mb-4 border-b pb-3">
					<div class="flex items-start justify-between">
						<div>
							<a
								href="/editions/{editionId}"
								class="text-lg font-semibold text-blue-600 hover:underline"
							>
								{group.edition.name}
							</a>
							<div class="text-sm text-gray-600">
								{group.edition.workTitle}
								{#if group.edition.composer}
									<span class="text-gray-400">{m.edition_view_by_composer()} {group.edition.composer}</span>
								{/if}
							</div>
						</div>
						<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
							{m.missing_count_badge({ count: group.members.length })}
						</span>
					</div>
				</div>

				<!-- Members Table -->
				<table class="w-full">
					<thead>
						<tr class="text-left text-sm font-medium text-gray-500">
							<th class="pb-2">{m.members_title()}</th>
							<th class="pb-2">{m.missing_table_section()}</th>
							<th class="pb-2 text-right">{m.missing_table_action()}</th>
						</tr>
					</thead>
					<tbody>
						{#each group.members as member}
							<tr class="border-t hover:bg-gray-50">
								<td class="py-2 font-medium text-gray-900">{member.name}</td>
								<td class="py-2 text-gray-600">{member.sectionName}</td>
								<td class="py-2 text-right">
									<a
										href="/editions/{editionId}?assign={member.id}"
										class="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
									>
										{m.missing_assign_copy_btn()}
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</Card>
		{/each}
	{/if}
</div>
