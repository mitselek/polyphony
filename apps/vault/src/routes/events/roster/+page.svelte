<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { PlannedStatus, ActualStatus } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Reactive copy of data for local updates
	let roster = $state(untrack(() => data.roster));
	let sections = $state(untrack(() => data.sections));
	let filters = $state(untrack(() => data.filters));

	// Filter state
	let selectedSectionId = $state(untrack(() => filters.sectionId ?? ''));
	
	// Default start date: one month ago
	function getDefaultStartDate(): string {
		const date = new Date();
		date.setMonth(date.getMonth() - 1);
		return date.toISOString().split('T')[0];
	}
	
	let startDate = $state(
		untrack(() => (filters.start ? new Date(filters.start).toISOString().split('T')[0] : getDefaultStartDate()))
	);
	let endDate = $state(
		untrack(() => (filters.end ? new Date(filters.end).toISOString().split('T')[0] : ''))
	);

	// Watch for data changes (e.g., on navigation) and update local state
	$effect(() => {
		roster = data.roster;
		sections = data.sections;
		filters = data.filters;
	});

	// Helper: Get CSS class for status color coding
	// Pattern Note: This could be extracted as a reusable component for future tables
	// See Issue #90+ for pattern extraction after establishing base functionality
	function getStatusClass(
		plannedStatus: PlannedStatus | null,
		actualStatus: ActualStatus | null,
		eventDate: string
	): string {
		const isPastEvent = new Date(eventDate) < new Date();

		// Past events: use actual status if recorded, otherwise show planned
		if (isPastEvent) {
			if (actualStatus === 'present') return 'status-yes';
			if (actualStatus === 'absent') return 'status-no';
			if (actualStatus === 'late') return 'status-late';
		}

		// Future events or past without actual: show planned
		if (plannedStatus === 'yes') return 'status-yes';
		if (plannedStatus === 'no') return 'status-no';
		if (plannedStatus === 'maybe') return 'status-maybe';
		if (plannedStatus === 'late') return 'status-late';

		// No response
		return 'status-none';
	}

	// Helper: Get display text for status
	function getStatusText(
		plannedStatus: PlannedStatus | null,
		actualStatus: ActualStatus | null,
		eventDate: string
	): string {
		const isPastEvent = new Date(eventDate) < new Date();

		if (isPastEvent) {
			if (actualStatus === 'present') return '✓';
			if (actualStatus === 'absent') return '✗';
			if (actualStatus === 'late') return '⏰';
			// Show planned if actual not recorded
			if (plannedStatus === 'yes') return '✓?';
			if (plannedStatus === 'no') return '✗?';
			if (plannedStatus === 'maybe') return '?';
			if (plannedStatus === 'late') return '⏰?';
		} else {
			if (plannedStatus === 'yes') return '✓';
			if (plannedStatus === 'no') return '✗';
			if (plannedStatus === 'maybe') return '?';
			if (plannedStatus === 'late') return '⏰';
		}

		return '-';
	}

	// Helper: Format date for display
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	// Helper: Format time for display (e.g., "7:00 PM")
	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	}

	// Apply filters by navigating with query params
	function applyFilters() {
		const params = new URLSearchParams();
		if (startDate) params.set('start', new Date(startDate).toISOString());
		if (endDate) params.set('end', new Date(endDate).toISOString());
		if (selectedSectionId) params.set('sectionId', selectedSectionId);

		goto(`/events/roster?${params.toString()}`);
	}

	// Build CSV export URL
	let csvExportUrl = $derived(() => {
		const params = new URLSearchParams();
		if (filters.start) params.set('start', filters.start);
		if (filters.end) params.set('end', filters.end);
		if (filters.sectionId) params.set('sectionId', filters.sectionId);
		params.set('format', 'csv');
		return `/api/events/roster?${params.toString()}`;
	});

	// Navigate to event detail page
	function navigateToEvent(eventId: string) {
		window.location.href = `/events/${eventId}`;
	}
</script>

<svelte:head>
	<title>Roster | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-full px-4 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Roster</h1>
		<p class="mt-2 text-gray-600">Member participation across events</p>
	</div>

	<!-- Filter Controls -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap items-end gap-4">
			<!-- Date Range -->
			<div class="flex-1 min-w-50">
				<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
					Start Date
				</label>
				<input
					id="start-date"
					type="date"
					bind:value={startDate}
					onchange={applyFilters}
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				/>
			</div>

			<div class="flex-1 min-w-50">
				<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
					End Date
				</label>
				<input
					id="end-date"
					type="date"
					bind:value={endDate}
					onchange={applyFilters}
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				/>
			</div>

			<!-- Section Filter (Epic #73 requirement: section-based, not voice) -->
			<div class="flex-1 min-w-50">
				<label for="section-filter" class="block text-sm font-medium text-gray-700 mb-1">
					Section
				</label>
				<select
					id="section-filter"
					bind:value={selectedSectionId}
					onchange={applyFilters}
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					<option value="">All Sections</option>
					{#each sections as section}
						<option value={section.id}>{section.name}</option>
					{/each}
				</select>
			</div>

			<!-- CSV Export Link -->
			<div>
				<a
					href={csvExportUrl()}
					class="inline-block rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
					download="roster.csv"
				>
					Export CSV
				</a>
			</div>
		</div>
	</div>

	<!-- Roster Table -->
	{#if roster.events.length === 0}
		<div class="rounded-lg border border-gray-200 bg-white p-8 text-center">
			<p class="text-gray-500">No events in selected date range</p>
		</div>
	{:else if roster.members.length === 0}
		<div class="rounded-lg border border-gray-200 bg-white p-8 text-center">
			<p class="text-gray-500">No members match filters</p>
		</div>
	{:else}
		<!-- Table Container with Horizontal Scroll -->
		<!-- Pattern Note: This is the first table component in Polyphony -->
		<!-- Sticky positioning pattern established here for future reuse -->
		<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full border-collapse">
				<thead class="border-b-2 border-gray-300">
					<tr>
						<!-- Sticky Name Column Header -->
						<!-- Z-index layering: 30 for corner cells (sticky both directions) -->
						<!-- Z-index 20 for sticky column headers, 10 for sticky row headers -->
						<th
							class="sticky left-0 top-0 z-30 border-r-2 border-gray-300 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700"
							style="min-width: 150px;"
						>
							Name
						</th>

						<!-- Sticky Section Column Header -->
						<th
						class="sticky left-37.5 top-0 z-30 border-r-2 border-gray-300 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700"
							style="min-width: 120px;"
						>
							Section
						</th>

						<!-- Event Column Headers (scrollable) -->
						{#each roster.events as event}
							<th
								class="sticky top-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition"
								style="min-width: 100px;"
								onclick={() => navigateToEvent(event.id)}
								title="Click to view event details"
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && navigateToEvent(event.id)}
							>
								<div class="flex flex-col gap-0.5">
									<span class="font-semibold">{event.name}</span>
									<span class="text-gray-500">{formatDate(event.date)}</span>
									<span class="text-gray-400">{formatTime(event.date)}</span>
								</div>
							</th>
						{/each}
					</tr>
				</thead>

				<tbody>
					{#each roster.members as member, index}
						{@const prevMember = index > 0 ? roster.members[index - 1] : null}
						{@const currentSectionId = member.primarySection?.id}
						{@const prevSectionId = prevMember?.primarySection?.id}
						{@const isNewSection = index === 0 || currentSectionId !== prevSectionId}

						{#if isNewSection && index > 0}
							<!-- Section Spacer -->
							<tr class="h-2 bg-gray-50">
								<td colspan={2 + roster.events.length} class="border-none"></td>
							</tr>
						{/if}

						<tr class="border-b border-gray-100 hover:bg-gray-50">
							<!-- Sticky Name Cell (clickable) -->
							<td
								class="sticky left-0 z-20 border-r-2 border-gray-300 bg-white text-sm font-medium text-gray-900 p-0"
							>
								<a
									href="/members/{member.id}"
									class="block px-4 py-3 hover:bg-blue-50 hover:text-blue-600"
								>
									{member.name}
								</a>
							</td>

							<!-- Sticky Section Cell -->
							<td
								class="sticky left-37.5 z-20 border-r-2 border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
							>
								{#if member.primarySection}
									<span
										class="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800"
										title={member.primarySection.name}
									>
										{member.primarySection.abbreviation}
									</span>
								{:else}
									<span class="text-gray-400">-</span>
								{/if}
							</td>

							<!-- Event Participation Cells (scrollable) -->
							{#each roster.events as event}
								{@const participationMap = event.participation}
								{@const status = participationMap.get(member.id)}
								{@const statusClass = status
									? getStatusClass(status.plannedStatus, status.actualStatus, event.date)
									: 'status-none'}
								{@const statusText = status
									? getStatusText(status.plannedStatus, status.actualStatus, event.date)
									: '-'}

								<td
									class="border-r border-gray-200 px-3 py-3 text-center text-sm {statusClass}"
									title="{member.name} - {event.name}: {status?.plannedStatus ?? 'No response'}"
								>
									{statusText}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Summary Stats -->
		<div class="mt-4 space-y-4">
			<!-- Overall Summary -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="flex gap-6 text-sm text-gray-600">
					<div>
						<span class="font-medium">Events:</span>
						{roster.summary.totalEvents}
					</div>
					<div>
						<span class="font-medium">Members:</span>
						{roster.summary.totalMembers}
					</div>
					<div>
						<span class="font-medium">Avg Attendance:</span>
						{roster.summary.averageAttendance.toFixed(1)}%
					</div>
				</div>
			</div>

			<!-- Section Summary (Epic #73) -->
			{#if Object.keys(roster.summary.sectionStats).length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h3 class="text-sm font-semibold text-gray-700 mb-3">Section Breakdown</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each Object.entries(roster.summary.sectionStats).sort((a, b) => a[1].sectionName.localeCompare(b[1].sectionName)) as [sectionId, stats]}
							<div class="rounded border border-gray-200 bg-gray-50 p-3">
								<div class="flex items-center justify-between mb-2">
									<span class="font-medium text-gray-700">{stats.sectionName}</span>
									<span class="text-xs text-gray-500">{stats.sectionAbbr}</span>
								</div>
								<div class="space-y-1 text-xs text-gray-600">
									<div class="flex justify-between">
										<span>Total:</span>
										<span class="font-medium">{stats.total}</span>
									</div>
									<div class="flex justify-between">
										<span>Response rate:</span>
										<span class="font-medium">
											{stats.total > 0 ? ((stats.responded / stats.total) * 100).toFixed(0) : 0}%
										</span>
									</div>
									<div class="flex justify-between items-center gap-2">
										<span>Yes:</span>
										<div class="flex items-center gap-1 flex-1">
											<div class="flex-1 h-4 bg-gray-200 rounded-sm overflow-hidden">
												<div 
													class="h-full bg-green-500 transition-all"
													style="width: {stats.responded > 0 ? (stats.yes / stats.responded * 100) : 0}%"
												></div>
											</div>
											<span class="font-medium w-8 text-right">{stats.yes}</span>
										</div>
									</div>
									<div class="flex justify-between items-center gap-2">
										<span>No:</span>
										<div class="flex items-center gap-1 flex-1">
											<div class="flex-1 h-4 bg-gray-200 rounded-sm overflow-hidden">
												<div 
													class="h-full bg-red-500 transition-all"
													style="width: {stats.responded > 0 ? (stats.no / stats.responded * 100) : 0}%"
												></div>
											</div>
											<span class="font-medium w-8 text-right">{stats.no}</span>
										</div>
									</div>
									{#if stats.maybe > 0}
										<div class="flex justify-between items-center gap-2">
											<span>Maybe:</span>
											<div class="flex items-center gap-1 flex-1">
												<div class="flex-1 h-4 bg-gray-200 rounded-sm overflow-hidden">
													<div 
														class="h-full bg-yellow-500 transition-all"
														style="width: {stats.responded > 0 ? (stats.maybe / stats.responded * 100) : 0}%"
													></div>
												</div>
												<span class="font-medium w-8 text-right">{stats.maybe}</span>
											</div>
										</div>
									{/if}
									{#if stats.late > 0}
										<div class="flex justify-between items-center gap-2">
											<span>Late:</span>
											<div class="flex items-center gap-1 flex-1">
												<div class="flex-1 h-4 bg-gray-200 rounded-sm overflow-hidden">
													<div 
														class="h-full bg-orange-500 transition-all"
														style="width: {stats.responded > 0 ? (stats.late / stats.responded * 100) : 0}%"
													></div>
												</div>
												<span class="font-medium w-8 text-right">{stats.late}</span>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Color-coded status cells */
	/* Pattern Note: These classes can be extracted to shared CSS for future tables */
	/* See Issue #90+ for pattern extraction */

	.status-yes {
		background-color: #d1fae5; /* green-100 */
		color: #065f46; /* green-800 */
	}

	.status-no {
		background-color: #fee2e2; /* red-100 */
		color: #991b1b; /* red-800 */
	}

	.status-maybe {
		background-color: #fef3c7; /* yellow-100 */
		color: #92400e; /* yellow-800 */
	}

	.status-late {
		background-color: #fed7aa; /* orange-100 */
		color: #9a3412; /* orange-800 */
	}

	.status-none {
		background-color: #f3f4f6; /* gray-100 */
		color: #6b7280; /* gray-500 */
	}

	/* Ensure sticky cells have proper background on hover */
	tr:hover td.sticky {
		background-color: #f9fafb; /* gray-50 - matches hover:bg-gray-50 */
	}

	/* Ensure proper layering for sticky corners */
	/* This pattern is critical for tables with both sticky headers and columns */
	thead th.sticky {
		box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.1); /* Subtle right shadow for depth */
	}

	tbody td.sticky {
		box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.1); /* Matches header shadow */
	}
</style>
