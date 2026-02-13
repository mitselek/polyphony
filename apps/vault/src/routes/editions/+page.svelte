<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { EditionType, LicenseType, Section } from '$lib/types';
	import type { EditionWithWork } from '$lib/server/db/editions';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Local state
	let editions = $state<EditionWithWork[]>(untrack(() => data.editions));
	let sections = $state<Section[]>(untrack(() => data.sections));
	let searchQuery = $state('');
	let filterType = $state<EditionType | ''>('');
	let filterLicense = $state<LicenseType | ''>('');

	// Sync with data on navigation
	$effect(() => {
		editions = data.editions;
		sections = data.sections;
	});

	const editionTypes: { value: EditionType; label: string }[] = [
		{ value: 'full_score', label: 'Full Score' },
		{ value: 'vocal_score', label: 'Vocal Score' },
		{ value: 'part', label: 'Part' },
		{ value: 'reduction', label: 'Reduction' },
		{ value: 'audio', label: 'Audio' },
		{ value: 'video', label: 'Video' },
		{ value: 'supplementary', label: 'Supplementary' }
	];

	const licenseTypes: { value: LicenseType; label: string }[] = [
		{ value: 'public_domain', label: 'Public Domain' },
		{ value: 'licensed', label: 'Licensed' },
		{ value: 'owned', label: 'Owned' }
	];

	let filteredEditions = $derived(
		editions.filter((e) => {
			// Text search
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				!query ||
				e.name.toLowerCase().includes(query) ||
				e.workTitle.toLowerCase().includes(query) ||
				(e.workComposer?.toLowerCase().includes(query) ?? false) ||
				(e.publisher?.toLowerCase().includes(query) ?? false);

			// Type filter
			const matchesType = !filterType || e.editionType === filterType;

			// License filter
			const matchesLicense = !filterLicense || e.licenseType === filterLicense;

			return matchesSearch && matchesType && matchesLicense;
		})
	);

	function getTypeLabel(type: EditionType): string {
		return editionTypes.find((t) => t.value === type)?.label ?? type;
	}

	function getLicenseLabel(license: LicenseType): string {
		return licenseTypes.find((l) => l.value === license)?.label ?? license;
	}

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

	function clearFilters() {
		searchQuery = '';
		filterType = '';
		filterLicense = '';
	}
</script>

<svelte:head>
	<title>{m.editions_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">{m.editions_title()}</h1>
			<p class="mt-2 text-gray-600">{m.editions_description()}</p>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap gap-4">
			<!-- Search -->
			<div class="flex-1 min-w-50">
				<label for="search" class="block text-sm font-medium text-gray-700 mb-1">{m.editions_search_label()}</label>
				<input
					id="search"
					type="text"
					bind:value={searchQuery}
					placeholder={m.editions_search_placeholder()}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				/>
			</div>

			<!-- Type Filter -->
			<div class="w-48">
				<label for="type-filter" class="block text-sm font-medium text-gray-700 mb-1">{m.editions_type_filter_label()}</label>
				<select
					id="type-filter"
					bind:value={filterType}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					<option value="">{m.editions_type_filter_all()}</option>
					{#each editionTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>

			<!-- License Filter -->
			<div class="w-48">
				<label for="license-filter" class="block text-sm font-medium text-gray-700 mb-1">{m.editions_license_filter_label()}</label>
				<select
					id="license-filter"
					bind:value={filterLicense}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					<option value="">{m.editions_license_filter_all()}</option>
					{#each licenseTypes as license}
						<option value={license.value}>{license.label}</option>
					{/each}
				</select>
			</div>

			<!-- Clear Filters -->
			{#if searchQuery || filterType || filterLicense}
				<div class="flex items-end">
					<button
						type="button"
						onclick={clearFilters}
						class="rounded-lg border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50"
					>
						{m.editions_clear_filters_btn()}
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Results count -->
	<p class="mb-4 text-sm text-gray-500">
		{filteredEditions.length} of {editions.length} editions
	</p>

	<!-- Edition List -->
	{#if filteredEditions.length === 0}
		<div class="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
			{#if editions.length === 0}
				<p class="text-gray-500">{m.editions_empty()}</p>
				<p class="mt-2 text-sm text-gray-400">
					{m.editions_empty_help()}
				</p>
			{:else}
				<p class="text-gray-500">{m.editions_no_match()}</p>
				<button
					type="button"
					onclick={clearFilters}
					class="mt-2 text-blue-600 hover:underline"
				>
					{m.editions_clear_filters_link()}
				</button>
			{/if}
		</div>
	{:else}
		<div class="space-y-3">
			{#each filteredEditions as edition (edition.id)}
				<a
					href="/editions/{edition.id}"
					class="group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<!-- Edition name -->
							<h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
								{edition.name}
							</h3>

							<!-- Work info -->
							<p class="mt-1 text-gray-600">
								{edition.workTitle}
								{#if edition.workComposer}
									<span class="text-gray-400">by</span> {edition.workComposer}
								{/if}
							</p>

							<!-- Publisher / Arranger -->
							{#if edition.publisher || edition.arranger}
								<p class="mt-1 text-sm text-gray-500">
									{#if edition.publisher}
										<span>{edition.publisher}</span>
									{/if}
									{#if edition.arranger}
										<span class="text-gray-400">arr.</span> {edition.arranger}
									{/if}
								</p>
							{/if}
						</div>

						<!-- Tags and indicators -->
						<div class="flex flex-col items-end gap-2 ml-4">
							<!-- Type badge -->
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getTypeClass(edition.editionType)}">
								{getTypeLabel(edition.editionType)}
							</span>

							<!-- License badge -->
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getLicenseClass(edition.licenseType)}">
								{getLicenseLabel(edition.licenseType)}
							</span>

							<!-- Asset indicators -->
							<div class="flex gap-1">
								{#if edition.fileKey}
									<span class="text-gray-400" title="Has file">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									</span>
								{/if}
								{#if edition.externalUrl}
									<span class="text-gray-400" title="Has external link">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Voicing -->
					{#if edition.voicing}
						<p class="mt-2 text-sm text-gray-500">
							<span class="font-medium">Voicing:</span> {edition.voicing}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
