<script lang="ts">
	import type { PageData } from './$types';
	import type { EditionType, LicenseType } from '$lib/types';

	let { data }: { data: PageData } = $props();

	const editionTypes: Record<EditionType, string> = {
		full_score: 'Full Score',
		vocal_score: 'Vocal Score',
		part: 'Part',
		reduction: 'Reduction',
		audio: 'Audio',
		video: 'Video',
		supplementary: 'Supplementary'
	};

	const licenseTypes: Record<LicenseType, string> = {
		public_domain: 'Public Domain',
		licensed: 'Licensed',
		owned: 'Owned'
	};

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
</script>

<svelte:head>
	<title>{data.edition.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="mb-6 text-sm text-gray-500">
		<a href="/editions" class="hover:text-blue-600 hover:underline">Editions</a>
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
						<span class="text-gray-400">by</span> {data.work.composer}
					{/if}
				</p>
			</div>

			{#if data.canManage}
				<a
					href="/works/{data.work.id}"
					class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
				>
					Edit Edition
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
			<h2 class="mb-4 text-lg font-semibold">Details</h2>
			
			<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#if data.edition.publisher}
					<div>
						<dt class="text-sm font-medium text-gray-500">Publisher</dt>
						<dd class="mt-1 text-gray-900">{data.edition.publisher}</dd>
					</div>
				{/if}

				{#if data.edition.arranger}
					<div>
						<dt class="text-sm font-medium text-gray-500">Arranger</dt>
						<dd class="mt-1 text-gray-900">{data.edition.arranger}</dd>
					</div>
				{/if}

				{#if data.edition.voicing}
					<div>
						<dt class="text-sm font-medium text-gray-500">Voicing</dt>
						<dd class="mt-1 text-gray-900">{data.edition.voicing}</dd>
					</div>
				{/if}

				{#if linkedSections.length > 0}
					<div>
						<dt class="text-sm font-medium text-gray-500">Sections</dt>
						<dd class="mt-1 flex flex-wrap gap-1">
							{#each linkedSections as section}
								<span class="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
									{section.abbreviation}
								</span>
							{/each}
						</dd>
					</div>
				{/if}
			</dl>

			{#if data.edition.notes}
				<div class="mt-4 border-t border-gray-100 pt-4">
					<dt class="text-sm font-medium text-gray-500">Notes</dt>
					<dd class="mt-1 whitespace-pre-wrap text-gray-900">{data.edition.notes}</dd>
				</div>
			{/if}
		</div>

		<!-- Digital Assets Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-semibold">Digital Assets</h2>

			{#if !data.edition.fileKey && !data.edition.externalUrl}
				<p class="text-gray-500">No digital assets attached to this edition.</p>
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
											• Uploaded {new Date(data.edition.fileUploadedAt).toLocaleDateString()}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex gap-2">
								<a
									href="/editions/{data.edition.id}/view"
									class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
								>
									View
								</a>
								<a
									href="/api/editions/{data.edition.id}/file"
									class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
									download
								>
									Download
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
									<p class="font-medium text-gray-900">External Link</p>
									<p class="text-sm text-gray-500 truncate max-w-md">{data.edition.externalUrl}</p>
								</div>
							</div>
							<a
								href={data.edition.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
							>
								Open Link
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
