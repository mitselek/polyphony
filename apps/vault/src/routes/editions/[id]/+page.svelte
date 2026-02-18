<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { EditionType, LicenseType } from '$lib/types';
	import Modal from '$lib/components/Modal.svelte';
	import EditionFileActions from '$lib/components/EditionFileActions.svelte';
	import { SectionBadge } from '$lib/components/badges';
	import { toast } from '$lib/stores/toast';
	import { getEditionViewUrl, getEditionDownloadUrl } from '$lib/utils/urls';
	import { groupBySection } from '$lib/utils/section-ordering';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Physical copies state (untrack to capture initial value, $effect syncs updates)
	let copies = $state(untrack(() => data.copies));
	let showCreateForm = $state(false);
	let showAssignModal = $state(false);
	let selectedCopyId = $state<string | null>(null);
	let creating = $state(false);
	let assigning = $state(false);
	let returning = $state(false);
	let deleting = $state<string | null>(null);

	// Create form state
	let batchCount = $state(1);
	let batchPrefix = $state('');
	let copyCondition = $state<'good' | 'fair' | 'poor'>('good');

	// Assign modal state
	let selectedMemberId = $state('');
	let memberSearchQuery = $state('');

	// Sync copies when data changes
	$effect(() => {
		copies = data.copies;
	});

	// Filter and group members for assignment dropdown
	const filteredMembers = $derived(() => {
		const query = memberSearchQuery.toLowerCase().trim();
		return data.members.filter((m) => {
			if (!query) return true;
			const displayName = m.nickname || m.name;
			return displayName.toLowerCase().includes(query) || m.name.toLowerCase().includes(query);
		});
	});

	// Group filtered members by section, ordered by section displayOrder then member name
	const membersBySection = $derived(() => {
		const members = filteredMembers();
		const groups = groupBySection(members, (m) => m.primarySection);

		// Sort members within each section by display name
		for (const [, sectionMembers] of groups) {
			sectionMembers.sort((a, b) => {
				const nameA = a.nickname || a.name;
				const nameB = b.nickname || b.name;
				return nameA.localeCompare(nameB);
			});
		}

		return groups;
	});

	const editionTypes = $derived<Record<EditionType, string>>({
		full_score: m.edition_type_full_score(),
		vocal_score: m.edition_type_vocal_score(),
		part: m.edition_type_part(),
		reduction: m.edition_type_reduction(),
		audio: m.edition_type_audio(),
		video: m.edition_type_video(),
		supplementary: m.edition_type_supplementary()
	});

	const licenseTypes = $derived<Record<LicenseType, string>>({
		public_domain: m.edition_license_public_domain(),
		licensed: m.edition_license_licensed(),
		owned: m.edition_license_owned()
	});

	function getTypeClass(type: EditionType): string {
		switch (type) {
			case 'full_score':
				return 'bg-purple-100 text-purple-800';
			case 'vocal_score':
				return 'bg-blue-100 text-blue-800';
			case 'part':
				return 'bg-green-100 text-green-800';
			case 'reduction':
				return 'bg-orange-100 text-orange-800';
			case 'audio':
				return 'bg-pink-100 text-pink-800';
			case 'video':
				return 'bg-red-100 text-red-800';
			case 'supplementary':
				return 'bg-gray-100 text-gray-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getLicenseClass(license: LicenseType): string {
		switch (license) {
			case 'public_domain':
				return 'bg-green-100 text-green-800';
			case 'licensed':
				return 'bg-amber-100 text-amber-800';
			case 'owned':
				return 'bg-blue-100 text-blue-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Get section names for display
	const linkedSections = $derived(
		data.edition.sectionIds
			?.map((id) => data.sections.find((s) => s.id === id))
			.filter((s): s is NonNullable<typeof s> => s !== undefined) ?? []
	);

	// Physical copies summary
	const copyStats = $derived({
		total: copies.length,
		assigned: copies.filter((c) => c.assignment).length,
		available: copies.filter((c) => !c.assignment).length
	});

	async function createCopies() {
		creating = true;

		try {
			const response = await fetch(`/api/editions/${data.edition.id}/copies`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					count: batchCount,
					prefix: batchPrefix || undefined,
					condition: copyCondition
				})
			});

			if (!response.ok) {
				const respData = (await response.json()) as { error?: string };
				throw new Error(respData.error ?? 'Failed to create copies');
			}

			const newCopies = (await response.json()) as typeof copies;
			copies = [...copies, ...newCopies.map((c) => ({ ...c, assignment: null }))];
			showCreateForm = false;
			batchCount = 1;
			batchPrefix = '';
			toast.success(`Created ${newCopies.length} cop${newCopies.length === 1 ? 'y' : 'ies'}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create copies');
		} finally {
			creating = false;
		}
	}

	function openAssignModal(copyId: string) {
		selectedCopyId = copyId;
		selectedMemberId = '';
		showAssignModal = true;
	}

	function closeAssignModal() {
		showAssignModal = false;
		memberSearchQuery = '';
	}

	async function assignCopy() {
		if (!selectedCopyId || !selectedMemberId) return;

		assigning = true;

		try {
			const response = await fetch(`/api/copies/${selectedCopyId}/assign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ memberId: selectedMemberId })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { error?: string };
				throw new Error(respData.error ?? 'Failed to assign copy');
			}

			const assignment = (await response.json()) as { id: string; memberId: string; assignedAt: string };
			const member = data.members.find((m) => m.id === selectedMemberId);

			copies = copies.map((c) =>
				c.id === selectedCopyId
					? {
							...c,
							assignment: {
								id: assignment.id,
								memberId: assignment.memberId,
								memberName: member?.name ?? 'Unknown',
								assignedAt: assignment.assignedAt
							}
						}
					: c
			);

			showAssignModal = false;
			toast.success(`Copy assigned to ${member?.name}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to assign copy');
		} finally {
			assigning = false;
		}
	}

	async function returnCopy(copyId: string, assignmentId: string) {
		returning = true;

		try {
			const response = await fetch(`/api/copies/${copyId}/return`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ assignmentId })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { error?: string };
				throw new Error(respData.error ?? 'Failed to return copy');
			}

			copies = copies.map((c) => (c.id === copyId ? { ...c, assignment: null } : c));
			toast.success(m.copies_toast_returned());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to return copy');
		} finally {
			returning = false;
		}
	}

	async function deleteCopy(copyId: string, copyNumber: string) {
		const confirmed = confirm(`Delete copy ${copyNumber}? This cannot be undone.`);
		if (!confirmed) return;

		deleting = copyId;

		try {
			const response = await fetch(`/api/copies/${copyId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const respData = (await response.json()) as { error?: string };
				throw new Error(respData.error ?? 'Failed to delete copy');
			}

			copies = copies.filter((c) => c.id !== copyId);
			toast.success(`Copy ${copyNumber} deleted`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete copy');
		} finally {
			deleting = null;
		}
	}

	function getConditionClass(condition: string): string {
		switch (condition) {
			case 'good':
				return 'text-green-600';
			case 'fair':
				return 'text-amber-600';
			case 'poor':
				return 'text-red-600';
			case 'lost':
				return 'text-gray-400';
			default:
				return 'text-gray-600';
		}
	}
</script>

<svelte:head>
	<title>{data.edition.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="mb-6 text-sm text-gray-500">
		<a href="/editions" class="hover:text-blue-600 hover:underline">{m.editions_title()}</a>
		<span class="mx-2">›</span>
		<span class="text-gray-700">{data.edition.name}</span>
	</nav>

	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-3xl font-bold">{data.edition.name}</h1>
				<p class="mt-2 text-lg text-gray-600">
					<a href="/works/{data.work.id}" class="text-blue-600 hover:underline">{data.work.title}</a>
					{#if data.work.composer}
						<span class="text-gray-400">{m.edition_view_by_composer()}</span> {data.work.composer}
					{/if}
				</p>
			</div>

			{#if data.canManage}
				<a
					href="/works/{data.work.id}"
					class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
				>
					{m.edition_edit_link()}
				</a>
			{/if}
		</div>

		<!-- Type and License badges -->
		<div class="mt-4 flex gap-2">
			<span class="rounded-full px-3 py-1 text-sm font-medium {getTypeClass(data.edition.editionType)}">
				{editionTypes[data.edition.editionType]}
			</span>
			<span class="rounded-full px-3 py-1 text-sm font-medium {getLicenseClass(data.edition.licenseType)}">
				{licenseTypes[data.edition.licenseType]}
			</span>
		</div>
	</div>

	<div class="space-y-6">
		<!-- Metadata Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-semibold">{m.edition_details_section()}</h2>
			
			<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#if data.edition.publisher}
					<div>
						<dt class="text-sm font-medium text-gray-500">{m.edition_publisher_label()}</dt>
						<dd class="mt-1 text-gray-900">{data.edition.publisher}</dd>
					</div>
				{/if}

				{#if data.edition.arranger}
					<div>
						<dt class="text-sm font-medium text-gray-500">{m.edition_arranger_label()}</dt>
						<dd class="mt-1 text-gray-900">{data.edition.arranger}</dd>
					</div>
				{/if}

				{#if data.edition.voicing}
					<div>
						<dt class="text-sm font-medium text-gray-500">{m.edition_voicing_label()}</dt>
						<dd class="mt-1 text-gray-900">{data.edition.voicing}</dd>
					</div>
				{/if}

				{#if linkedSections.length > 0}
					<div>
						<dt class="text-sm font-medium text-gray-500">{m.edition_sections_label()}</dt>
						<dd class="mt-1 flex flex-wrap gap-1">
							{#each linkedSections as section}
								<SectionBadge {section} />
							{/each}
						</dd>
					</div>
				{/if}
			</dl>

			{#if data.edition.notes}
				<div class="mt-4 border-t border-gray-100 pt-4">
					<dt class="text-sm font-medium text-gray-500">{m.edition_notes_label()}</dt>
					<dd class="mt-1 whitespace-pre-wrap text-gray-900">{data.edition.notes}</dd>
				</div>
			{/if}
		</div>

		<!-- Digital Assets Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-semibold">{m.edition_digital_assets_title()}</h2>

			{#if !data.edition.fileKey && !data.edition.externalUrl}
				<p class="text-gray-500">{m.edition_no_digital_assets()}</p>
			{:else}
				<div class="space-y-4">
					<!-- File download -->
					{#if data.edition.fileKey && data.edition.fileName}
						<div class="flex items-center justify-between rounded-lg border border-gray-200 p-4">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-gray-900">{data.edition.fileName}</p>
									<p class="text-sm text-gray-500">
										{formatFileSize(data.edition.fileSize)}
										{#if data.edition.fileUploadedAt}
											• {m.edition_uploaded_date({ date: new Date(data.edition.fileUploadedAt).toLocaleDateString() })}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex gap-2">
								<a
									href={getEditionViewUrl(data.edition.id)}
									class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
								>
									{m.edition_view_btn()}
								</a>
								<a
									href={getEditionDownloadUrl(data.edition.id)}
									class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
								>
									{m.edition_view_download_btn()}
								</a>
							</div>
						</div>
					{/if}

					<!-- External link -->
					{#if data.edition.externalUrl}
						<div class="flex items-center justify-between rounded-lg border border-gray-200 p-4">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-gray-900">{m.edition_external_link_label()}</p>
									<p class="text-sm text-gray-500 truncate max-w-md">{data.edition.externalUrl}</p>
								</div>
							</div>
							<a
								href={data.edition.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
							>
								{m.edition_external_link_open()}
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Physical Copies Section (Librarians only) -->
		{#if data.canManage}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold">Physical Copies</h2>
						<p class="text-sm text-gray-500">
							{copyStats.total} cop{copyStats.total === 1 ? 'y' : 'ies'}
							{#if copyStats.total > 0}
								({copyStats.assigned} assigned, {copyStats.available} available)
							{/if}
						</p>
					</div>
					<button
						onclick={() => (showCreateForm = !showCreateForm)}
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						{showCreateForm ? m.copies_cancel_btn() : m.copies_add_btn()}
					</button>
				</div>

				<!-- Create Copies Form -->
				{#if showCreateForm}
					<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
						<h3 class="mb-3 font-medium text-gray-900">{m.copies_add_copies_title()}</h3>
						<div class="flex flex-wrap items-end gap-4">
							<div>
								<label for="count" class="block text-sm font-medium text-gray-700">{m.copies_count_label()}</label>
								<input
									id="count"
									type="number"
									min="1"
									max="100"
									bind:value={batchCount}
									class="mt-1 w-20 rounded-lg border border-gray-300 px-3 py-2"
								/>
							</div>
							<div>
								<label for="prefix" class="block text-sm font-medium text-gray-700">{m.copies_prefix_label()}</label>
								<input
									id="prefix"
									type="text"
									placeholder={m.copies_prefix_placeholder()}
									bind:value={batchPrefix}
									class="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2"
								/>
							</div>
							<div>
								<label for="condition" class="block text-sm font-medium text-gray-700">{m.copies_condition_label()}</label>
								<select
									id="condition"
									bind:value={copyCondition}
									class="mt-1 rounded-lg border border-gray-300 px-3 py-2"
								>
									<option value="good">{m.copies_condition_good()}</option>
									<option value="fair">{m.copies_condition_fair()}</option>
									<option value="poor">{m.copies_condition_poor()}</option>
								</select>
							</div>
							<button
								onclick={createCopies}
								disabled={creating || batchCount < 1}
								class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
							>
								{creating ? m.copies_creating() : m.copies_create_btn()}
							</button>
						</div>
						<p class="mt-2 text-xs text-gray-500">
							{#if batchPrefix}
								Creates: {batchPrefix}-01{#if batchCount > 1}, {batchPrefix}-02{#if batchCount > 2}, ...{/if}{/if}
							{:else}
								Creates: 1{#if batchCount > 1}, 2{#if batchCount > 2}, ...{/if}{/if}
							{/if}
						</p>
					</div>
				{/if}

				<!-- Copies List -->
				{#if copies.length === 0}
					<p class="py-8 text-center text-gray-500">No physical copies yet. Click "Add Copies" to create some.</p>
				{:else}
					<div class="overflow-hidden rounded-lg border border-gray-200">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_copy()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_condition()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_status()}</th>
									<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_actions()}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each copies as copy (copy.id)}
									<tr>
										<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{copy.copyNumber}</td>
										<td class="whitespace-nowrap px-4 py-3">
											<span class="capitalize {getConditionClass(copy.condition)}">{copy.condition}</span>
										</td>
										<td class="px-4 py-3">
											{#if copy.assignment}
												<div>
													<span class="font-medium text-gray-900">{copy.assignment.memberName}</span>
													<span class="block text-xs text-gray-500">
														{m.copies_since_date({ date: new Date(copy.assignment.assignedAt).toLocaleDateString() })}
													</span>
												</div>
											{:else}
												<span class="text-green-600">{m.copies_available_label()}</span>
											{/if}
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-right">
											{#if copy.assignment}
												<button
													onclick={() => returnCopy(copy.id, copy.assignment!.id)}
													disabled={returning}
													class="text-sm text-amber-600 hover:text-amber-800 disabled:opacity-50"
												>
													{m.copies_return_btn()}												</button>
											{:else}
												<button
													onclick={() => openAssignModal(copy.id)}
													class="text-sm text-blue-600 hover:text-blue-800"
												>
													{m.copies_assign_btn()}												</button>
												<button
													onclick={() => deleteCopy(copy.id, copy.copyNumber)}
													disabled={deleting === copy.id}
													class="ml-3 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
												>
													{deleting === copy.id ? '...' : m.copies_delete_btn()}
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Current Holders Section (Issue #125) -->
			{#if data.currentHolders.length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-lg font-semibold">{m.copies_holders_count({ count: data.currentHolders.length })}</h2>
					<p class="mb-4 text-sm text-gray-500">
						{m.copies_holders_desc()}
					</p>
					
					<div class="overflow-hidden rounded-lg border border-gray-200">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_copy()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_member()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_since()}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each data.currentHolders as holder (holder.copyId)}
									<tr>
										<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{holder.copyNumber}</td>
										<td class="whitespace-nowrap px-4 py-3">
											<a href="/members/{holder.memberId}" class="text-blue-600 hover:underline">
												{holder.memberName}
											</a>
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-gray-600">
											{new Date(holder.assignedAt).toLocaleDateString()}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Assignment History Section -->
			{#if data.assignmentHistory.length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-lg font-semibold">{m.copies_history_title()}</h2>
					<p class="mb-4 text-sm text-gray-500">
						{m.copies_history_desc()}
					</p>
					
					<div class="overflow-hidden rounded-lg border border-gray-200">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_copy()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_member()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_assigned()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_returned()}</th>
									<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{m.copies_header_assigned_by()}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each data.assignmentHistory as entry (entry.id)}
									<tr class={entry.returnedAt ? 'bg-gray-50' : ''}>
										<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{entry.copyNumber}</td>
										<td class="whitespace-nowrap px-4 py-3 text-gray-900">{entry.memberName}</td>
										<td class="whitespace-nowrap px-4 py-3 text-gray-600">
											{new Date(entry.assignedAt).toLocaleDateString()}
										</td>
										<td class="whitespace-nowrap px-4 py-3">
											{#if entry.returnedAt}
												<span class="text-gray-600">{new Date(entry.returnedAt).toLocaleDateString()}</span>
											{:else}
												<span class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">{m.copies_current_badge()}</span>
											{/if}
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-gray-500">
											{entry.assignedByName ?? '—'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Assign Copy Modal -->
<Modal open={showAssignModal} title={m.copies_assign_copy_title()} onclose={closeAssignModal}>
	<!-- Search filter -->
	<div class="mb-3">
		<input
			type="text"
			bind:value={memberSearchQuery}
			placeholder={m.copies_filter_name_placeholder()}
			class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
		/>
	</div>

	<div class="mb-4">
		<label for="member" class="block text-sm font-medium text-gray-700">{m.copies_select_member_label()}</label>
		<select
			id="member"
			bind:value={selectedMemberId}
			class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
			size="8"
		>
			{#each membersBySection() as [sectionName, members]}
				<optgroup label={sectionName}>
					{#each members as member}
						<option value={member.id}>
							{member.nickname || member.name}
						</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		{#if filteredMembers().length === 0}
			<p class="mt-2 text-sm text-gray-500">{m.copies_no_member_match()}</p>
		{/if}
	</div>

	<div class="flex justify-end gap-3">
		<button
			onclick={closeAssignModal}
			class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
		>
		{m.copies_cancel_btn()}
		</button>
		<button
			onclick={assignCopy}
			disabled={!selectedMemberId || assigning}
			class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
		>
			{assigning ? m.copies_assigning() : m.copies_assign_btn()}
		</button>
	</div>
</Modal>