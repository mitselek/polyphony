<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Selection state
	let selectedIds = $state(new Set<string>());
	let isReturning = $state(false);

	// Computed values
	const hasOutstanding = $derived(data.totalOutstanding > 0);
	const hasSelection = $derived(selectedIds.size > 0);

	function handleSeasonChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		goto(`?season=${select.value}`);
	}

	function toggleCopy(assignmentId: string) {
		if (selectedIds.has(assignmentId)) {
			selectedIds.delete(assignmentId);
		} else {
			selectedIds.add(assignmentId);
		}
		selectedIds = new Set(selectedIds); // Trigger reactivity
	}

	function toggleMember(memberId: string) {
		const member = data.outstandingByMember.find((m) => m.memberId === memberId);
		if (!member) return;

		const memberAssignmentIds = member.copies.map((c) => c.assignmentId);
		const allSelected = memberAssignmentIds.every((id) => selectedIds.has(id));

		if (allSelected) {
			// Deselect all
			memberAssignmentIds.forEach((id) => selectedIds.delete(id));
		} else {
			// Select all
			memberAssignmentIds.forEach((id) => selectedIds.add(id));
		}
		selectedIds = new Set(selectedIds); // Trigger reactivity
	}

	function selectAll() {
		for (const member of data.outstandingByMember) {
			for (const copy of member.copies) {
				selectedIds.add(copy.assignmentId);
			}
		}
		selectedIds = new Set(selectedIds);
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	async function markAsReturned() {
		if (selectedIds.size === 0) return;
		isReturning = true;

		try {
			const response = await fetch('/api/assignments/bulk-return', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ assignmentIds: [...selectedIds] })
			});

			if (!response.ok) {
				const result = (await response.json()) as { error?: string };
				throw new Error(result.error ?? m.collection_error_mark_returned());
			}

			const result = (await response.json()) as { returned: number };
			toast.success(m.collection_toast_marked_returned({ count: result.returned }));
			selectedIds = new Set();
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.collection_error_mark_returned());
		} finally {
			isReturning = false;
		}
	}

	function isMemberFullySelected(memberId: string): boolean {
		const member = data.outstandingByMember.find((m) => m.memberId === memberId);
		if (!member) return false;
		return member.copies.every((c) => selectedIds.has(c.assignmentId));
	}

	function isMemberPartiallySelected(memberId: string): boolean {
		const member = data.outstandingByMember.find((m) => m.memberId === memberId);
		if (!member) return false;
		const selectedCount = member.copies.filter((c) => selectedIds.has(c.assignmentId)).length;
		return selectedCount > 0 && selectedCount < member.copies.length;
	}
</script>

<svelte:head>
	<title>{m.library_collection_reminders_btn()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<nav class="mb-4 text-sm text-gray-500">
			<a href="/library" class="hover:text-blue-600">{m.library_breadcrumb()}</a>
			<span class="mx-2">›</span>
			<a href="/library/inventory" class="hover:text-blue-600">{m.library_inventory_title()}</a>
			<span class="mx-2">›</span>
			<span>{m.library_collection_reminders_btn()}</span>
		</nav>

		<h1 class="text-3xl font-bold">{m.library_collection_reminders_btn()}</h1>
		<p class="mt-2 text-gray-600">
			{m.collection_description()}
		</p>
	</div>

	<!-- Season Selector -->
	<div class="mb-6">
		<label for="season" class="block text-sm font-medium text-gray-700">{m.seasons_title()}</label>
		<select
			id="season"
			class="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2"
			value={data.selectedSeasonId ?? ''}
			onchange={handleSeasonChange}
		>
			{#if data.seasons.length === 0}
				<option value="">{m.seasons_empty()}</option>
			{:else}
				{#each data.seasons as season}
					<option value={season.id}>{season.name}</option>
				{/each}
			{/if}
		</select>
	</div>

	<!-- Summary -->
	{#if data.selectedSeasonId}
		<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
			{#if hasOutstanding}
				<p class="text-lg">
					{m.collection_summary_outstanding({ copies: data.totalOutstanding, members: data.memberCount })}
				</p>
			{:else}
				<p class="text-lg text-green-700">✓ {m.collection_all_collected()}</p>
			{/if}
		</div>
	{/if}

	<!-- Action Bar -->
	{#if hasOutstanding}
		<div class="mb-4 flex items-center gap-4">
			<button
				type="button"
				onclick={selectAll}
				class="text-sm text-blue-600 hover:underline"
			>
				{m.collection_select_all_btn()}
			</button>
			{#if hasSelection}
				<button
					type="button"
					onclick={deselectAll}
					class="text-sm text-gray-600 hover:underline"
				>
					{m.collection_deselect_all_btn()}
				</button>
				<button
					type="button"
					onclick={markAsReturned}
					disabled={isReturning}
					class="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isReturning}
						{m.collection_marking_returned()}
					{:else}
						{m.collection_mark_returned_btn({ count: selectedIds.size })}
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Outstanding Copies by Member -->
	{#if hasOutstanding}
		<div class="space-y-4">
			{#each data.outstandingByMember as member (member.memberId)}
				<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
					<!-- Member Header -->
					<div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
						<input
							type="checkbox"
							checked={isMemberFullySelected(member.memberId)}
							indeterminate={isMemberPartiallySelected(member.memberId)}
							onchange={() => toggleMember(member.memberId)}
							class="h-4 w-4 rounded border-gray-300"
						/>
						<h3 class="font-semibold">
							<a href="/members/{member.memberId}" class="text-blue-600 hover:underline">
								{member.memberName}
							</a>
						</h3>
						<span class="text-sm text-gray-500">
							{m.collection_member_copies_label({ count: member.copies.length })}
						</span>
					</div>

					<!-- Copies Table -->
					<table class="min-w-full">
						<tbody class="divide-y divide-gray-100">
							{#each member.copies as copy (copy.assignmentId)}
								<tr class="hover:bg-gray-50">
									<td class="w-10 px-4 py-2">
										<input
											type="checkbox"
											checked={selectedIds.has(copy.assignmentId)}
											onchange={() => toggleCopy(copy.assignmentId)}
											class="h-4 w-4 rounded border-gray-300"
										/>
									</td>
									<td class="px-4 py-2">
										<div class="font-medium text-gray-900">{copy.workTitle}</div>
										<div class="text-sm text-gray-500">{copy.editionName}</div>
									</td>
									<td class="whitespace-nowrap px-4 py-2 text-gray-600">
										{m.collection_copy_number()}{copy.copyNumber}
									</td>
									<td class="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
										{m.collection_assigned_since()} {new Date(copy.assignedAt).toLocaleDateString()}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	{/if}
</div>
