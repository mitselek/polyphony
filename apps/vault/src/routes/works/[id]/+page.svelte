<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { Edition, EditionType, LicenseType, Section } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Local state
	let editions = $state<Edition[]>(untrack(() => data.editions));
	let showEditionForm = $state(false);
	let editingEdition = $state<Edition | null>(null);
	let deletingId = $state<string | null>(null);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	// Form state
	let formName = $state('');
	let formArranger = $state('');
	let formPublisher = $state('');
	let formVoicing = $state('');
	let formEditionType = $state<EditionType>('vocal_score');
	let formLicenseType = $state<LicenseType>('owned');
	let formNotes = $state('');
	let formExternalUrl = $state('');
	let formSectionIds = $state<string[]>([]);

	const EDITION_TYPES: { value: EditionType; label: string }[] = [
		{ value: 'full_score', label: 'Full Score' },
		{ value: 'vocal_score', label: 'Vocal Score' },
		{ value: 'part', label: 'Part' },
		{ value: 'reduction', label: 'Reduction' },
		{ value: 'audio', label: 'Audio' },
		{ value: 'video', label: 'Video' },
		{ value: 'supplementary', label: 'Supplementary' }
	];

	const LICENSE_TYPES: { value: LicenseType; label: string }[] = [
		{ value: 'public_domain', label: 'Public Domain' },
		{ value: 'licensed', label: 'Licensed' },
		{ value: 'owned', label: 'Owned' }
	];

	// Sync with data on navigation
	$effect(() => {
		editions = data.editions;
	});

	function openCreateForm() {
		formName = '';
		formArranger = '';
		formPublisher = '';
		formVoicing = '';
		formEditionType = 'vocal_score';
		formLicenseType = 'owned';
		formNotes = '';
		formExternalUrl = '';
		formSectionIds = [];
		editingEdition = null;
		showEditionForm = true;
	}

	function openEditForm(edition: Edition) {
		formName = edition.name;
		formArranger = edition.arranger ?? '';
		formPublisher = edition.publisher ?? '';
		formVoicing = edition.voicing ?? '';
		formEditionType = edition.editionType;
		formLicenseType = edition.licenseType;
		formNotes = edition.notes ?? '';
		formExternalUrl = edition.externalUrl ?? '';
		formSectionIds = edition.sectionIds ?? [];
		editingEdition = edition;
		showEditionForm = true;
	}

	function closeForm() {
		showEditionForm = false;
		editingEdition = null;
	}

	function toggleSection(sectionId: string) {
		if (formSectionIds.includes(sectionId)) {
			formSectionIds = formSectionIds.filter((id) => id !== sectionId);
		} else {
			formSectionIds = [...formSectionIds, sectionId];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!formName.trim()) {
			error = 'Name is required';
			return;
		}

		saving = true;
		error = '';

		try {
			if (editingEdition) {
				// Update existing edition
				const response = await fetch(`/api/editions/${editingEdition.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: formName.trim(),
						arranger: formArranger.trim() || null,
						publisher: formPublisher.trim() || null,
						voicing: formVoicing.trim() || null,
						editionType: formEditionType,
						licenseType: formLicenseType,
						notes: formNotes.trim() || null,
						externalUrl: formExternalUrl.trim() || null,
						sectionIds: formSectionIds
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? 'Failed to update edition');
				}

				const updated = (await response.json()) as Edition;
				editions = editions.map((ed) => (ed.id === updated.id ? updated : ed));
				success = `"${updated.name}" updated successfully`;
			} else {
				// Create new edition
				const response = await fetch(`/api/works/${data.work.id}/editions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: formName.trim(),
						arranger: formArranger.trim() || undefined,
						publisher: formPublisher.trim() || undefined,
						voicing: formVoicing.trim() || undefined,
						editionType: formEditionType,
						licenseType: formLicenseType,
						notes: formNotes.trim() || undefined,
						externalUrl: formExternalUrl.trim() || undefined,
						sectionIds: formSectionIds.length > 0 ? formSectionIds : undefined
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? 'Failed to create edition');
				}

				const created = (await response.json()) as Edition;
				editions = [...editions, created];
				success = `"${created.name}" created successfully`;
			}

			closeForm();
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
		} finally {
			saving = false;
		}
	}

	async function deleteEdition(edition: Edition) {
		if (!confirm(`Delete "${edition.name}"? This cannot be undone.`)) return;

		deletingId = edition.id;
		error = '';

		try {
			const response = await fetch(`/api/editions/${edition.id}`, { method: 'DELETE' });

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to delete edition');
			}

			editions = editions.filter((ed) => ed.id !== edition.id);
			success = `"${edition.name}" deleted`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Delete failed';
		} finally {
			deletingId = null;
		}
	}

	function getEditionTypeLabel(type: EditionType): string {
		return EDITION_TYPES.find((t) => t.value === type)?.label ?? type;
	}

	function getLicenseTypeLabel(type: LicenseType): string {
		return LICENSE_TYPES.find((t) => t.value === type)?.label ?? type;
	}

	function getLicenseBadgeClass(type: LicenseType): string {
		switch (type) {
			case 'public_domain':
				return 'bg-green-100 text-green-800';
			case 'licensed':
				return 'bg-blue-100 text-blue-800';
			case 'owned':
				return 'bg-gray-100 text-gray-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>{data.work.title} | Works Catalog</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Breadcrumb -->
	<div class="mb-4">
		<a href="/works" class="text-blue-600 hover:underline">← Works Catalog</a>
	</div>

	<!-- Work Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold">{data.work.title}</h1>
		{#if data.work.composer}
			<p class="mt-1 text-xl text-gray-600">{data.work.composer}</p>
		{/if}
		{#if data.work.lyricist}
			<p class="text-gray-500">text: {data.work.lyricist}</p>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
			<button onclick={() => (error = '')} class="ml-2 text-red-900 hover:underline">×</button>
		</div>
	{/if}

	{#if success}
		<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
			{success}
		</div>
	{/if}

	<!-- Editions Section -->
	<div class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Editions</h2>
			{#if data.canManage}
				<button
					onclick={openCreateForm}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
				>
					+ Add Edition
				</button>
			{/if}
		</div>

		{#if editions.length === 0}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
				<p>No editions yet.</p>
				{#if data.canManage}
					<p class="mt-2">
						<button onclick={openCreateForm} class="text-blue-600 hover:underline">
							Add the first edition
						</button>
					</p>
				{/if}
			</div>
		{:else}
			<div class="space-y-3">
				{#each editions as edition (edition.id)}
					<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold">{edition.name}</h3>
									<span class="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
										{getEditionTypeLabel(edition.editionType)}
									</span>
									<span
										class="rounded px-2 py-0.5 text-xs {getLicenseBadgeClass(edition.licenseType)}"
									>
										{getLicenseTypeLabel(edition.licenseType)}
									</span>
								</div>
								<div class="mt-1 space-y-0.5 text-sm text-gray-600">
									{#if edition.arranger}
										<p>arr. {edition.arranger}</p>
									{/if}
									{#if edition.publisher}
										<p>{edition.publisher}</p>
									{/if}
									{#if edition.voicing}
										<p class="text-gray-500">{edition.voicing}</p>
									{/if}
								</div>
								{#if edition.externalUrl}
									<p class="mt-2">
										<a
											href={edition.externalUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="text-sm text-blue-600 hover:underline"
										>
											External link ↗
										</a>
									</p>
								{/if}
								{#if edition.fileName}
									<p class="mt-2 text-sm text-gray-500">
										📄 {edition.fileName}
									</p>
								{/if}
								{#if edition.notes}
									<p class="mt-2 text-sm italic text-gray-500">{edition.notes}</p>
								{/if}
							</div>
							{#if data.canManage}
								<div class="flex gap-2">
									<button
										onclick={() => openEditForm(edition)}
										class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-200"
									>
										Edit
									</button>
									<button
										onclick={() => deleteEdition(edition)}
										disabled={deletingId === edition.id}
										class="rounded bg-red-100 px-3 py-1 text-sm text-red-700 transition hover:bg-red-200 disabled:opacity-50"
									>
										{deletingId === edition.id ? '...' : 'Delete'}
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Edition Form Modal -->
	{#if showEditionForm}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edition-form-title"
			tabindex="-1"
			onclick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
			onkeydown={(e) => { if (e.key === 'Escape') closeForm(); }}
		>
			<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
				<h2 id="edition-form-title" class="mb-4 text-xl font-semibold">
					{editingEdition ? 'Edit Edition' : 'Add New Edition'}
				</h2>
				<form onsubmit={handleSubmit}>
					<div class="space-y-4">
						<!-- Name -->
						<div>
							<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
								Name <span class="text-red-500">*</span>
							</label>
							<input
								id="name"
								type="text"
								bind:value={formName}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
								placeholder="e.g., Novello Vocal Score"
								required
							/>
						</div>

						<!-- Edition Type -->
						<div>
							<label for="editionType" class="mb-1 block text-sm font-medium text-gray-700">
								Type
							</label>
							<select
								id="editionType"
								bind:value={formEditionType}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								{#each EDITION_TYPES as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</div>

						<!-- License Type -->
						<div>
							<label for="licenseType" class="mb-1 block text-sm font-medium text-gray-700">
								License
							</label>
							<select
								id="licenseType"
								bind:value={formLicenseType}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								{#each LICENSE_TYPES as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</div>

						<!-- Arranger -->
						<div>
							<label for="arranger" class="mb-1 block text-sm font-medium text-gray-700">
								Arranger
							</label>
							<input
								id="arranger"
								type="text"
								bind:value={formArranger}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
						</div>

						<!-- Publisher -->
						<div>
							<label for="publisher" class="mb-1 block text-sm font-medium text-gray-700">
								Publisher
							</label>
							<input
								id="publisher"
								type="text"
								bind:value={formPublisher}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
						</div>

						<!-- Voicing -->
						<div>
							<label for="voicing" class="mb-1 block text-sm font-medium text-gray-700">
								Voicing
							</label>
							<input
								id="voicing"
								type="text"
								bind:value={formVoicing}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
								placeholder="e.g., SATB div."
							/>
						</div>

						<!-- External URL -->
						<div>
							<label for="externalUrl" class="mb-1 block text-sm font-medium text-gray-700">
								External Link
							</label>
							<input
								id="externalUrl"
								type="url"
								bind:value={formExternalUrl}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
								placeholder="https://..."
							/>
						</div>

						<!-- Sections (for part assignments) -->
						{#if data.sections.length > 0}
							<fieldset>
								<legend class="mb-1 block text-sm font-medium text-gray-700">
									Sections (for parts)
								</legend>
								<p class="mb-2 text-xs text-gray-500">
									Leave empty for universal editions (full scores, audio)
								</p>
								<div class="flex flex-wrap gap-2" role="group" aria-label="Section assignments">
									{#each data.sections as section}
										<button
											type="button"
											onclick={() => toggleSection(section.id)}
											class="rounded-full border px-3 py-1 text-sm transition {formSectionIds.includes(
												section.id
											)
												? 'border-teal-500 bg-teal-100 text-teal-800'
												: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
										>
											{formSectionIds.includes(section.id) ? '✓ ' : ''}{section.abbreviation}
										</button>
									{/each}
								</div>
							</fieldset>
						{/if}

						<!-- Notes -->
						<div>
							<label for="notes" class="mb-1 block text-sm font-medium text-gray-700">
								Notes
							</label>
							<textarea
								id="notes"
								bind:value={formNotes}
								rows="2"
								class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							></textarea>
						</div>
					</div>

					<div class="mt-6 flex justify-end gap-3">
						<button
							type="button"
							onclick={closeForm}
							class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving}
							class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{saving ? 'Saving...' : editingEdition ? 'Update' : 'Create'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
