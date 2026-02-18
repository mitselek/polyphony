<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { Work } from '$lib/types';
	import Modal from '$lib/components/Modal.svelte';
	import Card from '$lib/components/Card.svelte';
	import { toast } from '$lib/stores/toast';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Local state
	let works = $state<Work[]>(untrack(() => data.works));
	let searchQuery = $state('');
	let showCreateForm = $state(false);
	let editingWork = $state<Work | null>(null);
	let deletingId = $state<string | null>(null);
	let saving = $state(false);
	let error = $state('');

	// Form state
	let formTitle = $state('');
	let formComposer = $state('');
	let formLyricist = $state('');

	// Sync with data on navigation
	$effect(() => {
		works = data.works;
	});

	let filteredWorks = $derived(
		works.filter(
			(w) =>
				w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(w.composer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
				(w.lyricist?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
		)
	);

	function openCreateForm() {
		formTitle = '';
		formComposer = '';
		formLyricist = '';
		editingWork = null;
		showCreateForm = true;
	}

	function openEditForm(work: Work) {
		formTitle = work.title;
		formComposer = work.composer ?? '';
		formLyricist = work.lyricist ?? '';
		editingWork = work;
		showCreateForm = true;
	}

	function closeForm() {
		showCreateForm = false;
		editingWork = null;
		formTitle = '';
		formComposer = '';
		formLyricist = '';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		if (!formTitle.trim()) {
			error = m.work_title_required();
			return;
		}

		saving = true;
		error = '';

		try {
			if (editingWork) {
				// Update existing work
				const response = await fetch(`/api/works/${editingWork.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: formTitle.trim(),
						composer: formComposer.trim() || null,
						lyricist: formLyricist.trim() || null
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? m.work_update_failed());
				}

				const updated = (await response.json()) as Work;
				works = works.map((w) => (w.id === updated.id ? updated : w));
				toast.success(m.work_updated_toast({ title: updated.title }));
			} else {
				// Create new work
				const response = await fetch('/api/works', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: formTitle.trim(),
						composer: formComposer.trim() || undefined,
						lyricist: formLyricist.trim() || undefined
					})
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					throw new Error(data.error ?? m.work_create_failed());
				}

				const created = (await response.json()) as Work;
				works = [...works, created].sort((a, b) => a.title.localeCompare(b.title));
				toast.success(m.work_created_toast({ title: created.title }));
			}

			closeForm();
		} catch (err) {
			error = err instanceof Error ? err.message : m.work_operation_failed();
		} finally {
			saving = false;
		}
	}

	async function deleteWork(work: Work) {
		if (!confirm(m.work_confirm_delete({ title: work.title }))) return;

		deletingId = work.id;
		error = '';

		try {
			const response = await fetch(`/api/works/${work.id}`, { method: 'DELETE' });

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? m.work_delete_failed());
			}

			works = works.filter((w) => w.id !== work.id);
			toast.success(m.work_deleted_toast({ title: work.title }));
		} catch (err) {
			error = err instanceof Error ? err.message : m.work_delete_failed();
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>{m.works_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">{m.works_title()}</h1>
			<p class="mt-1 text-gray-600">{m.works_description()}</p>
		</div>
		<div class="flex gap-3">
			{#if data.canManage}
				<a
					href="/library/inventory"
					class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
				>
					{m.works_inventory_btn()}
				</a>
				<button
					onclick={openCreateForm}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
				>
					{m.works_add_btn()}
				</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
			<button onclick={() => (error = '')} class="ml-2 text-red-900 hover:underline">×</button>
		</div>
	{/if}

	<!-- Create/Edit Form Modal -->
	<Modal open={showCreateForm} title={editingWork ? m.works_modal_title_edit() : m.works_modal_title_add()} onclose={closeForm}>
		<form onsubmit={handleSubmit}>
					<div class="mb-4">
						<label for="title" class="mb-1 block text-sm font-medium text-gray-700">
							{m.works_title_label()}
						</label>
						<input
							id="title"
							type="text"
							bind:value={formTitle}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							placeholder={m.works_title_placeholder()}
							required
						/>
					</div>
					<div class="mb-4">
						<label for="composer" class="mb-1 block text-sm font-medium text-gray-700">
							{m.works_composer_label()}
						</label>
						<input
							id="composer"
							type="text"
							bind:value={formComposer}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							placeholder={m.works_composer_placeholder()}
						/>
					</div>
					<div class="mb-6">
						<label for="lyricist" class="mb-1 block text-sm font-medium text-gray-700">
							{m.works_lyricist_label()}
						</label>
						<input
							id="lyricist"
							type="text"
							bind:value={formLyricist}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							placeholder={m.works_lyricist_placeholder()}
						/>
					</div>
					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={closeForm}
							class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
						>
							{m.actions_cancel()}
						</button>
						<button
							type="submit"
							disabled={saving}
							class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{saving ? m.actions_save() : editingWork ? m.actions_save() : m.actions_add()}
						</button>
					</div>
		</form>
	</Modal>

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder={m.works_search_placeholder()}
			class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
		/>
	</div>

	<!-- Works List -->
	{#if filteredWorks.length === 0}
		<div class="py-12 text-center text-gray-500">
			{#if works.length === 0}
				<p class="text-lg">{m.works_empty_message()}</p>
				{#if data.canManage}
					<p class="mt-2">
						<button onclick={openCreateForm} class="text-blue-600 hover:underline">
							{m.works_add_first()}
						</button>
					</p>
				{/if}
			{:else}
				<p>{m.works_no_match()}</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredWorks as work (work.id)}
				<Card variant="clickable" href="/works/{work.id}">
					<div class="flex items-center justify-between">
					<div class="flex-1">
						<h2 class="text-lg font-semibold group-hover:text-blue-600">{work.title}</h2>
						{#if work.composer}
							<p class="text-gray-600">{work.composer}</p>
						{/if}
						{#if work.lyricist}
							<p class="text-sm text-gray-500">{m.work_lyricist_prefix()} {work.lyricist}</p>
						{/if}
						<p class="mt-1 text-xs text-gray-400">
							{m.work_added_date({ date: new Date(work.createdAt).toLocaleDateString() })}
						</p>
					</div>
					{#if data.canManage}
						<div class="flex gap-2">
							<button
								onclick={(e) => { e.preventDefault(); e.stopPropagation(); openEditForm(work); }}
								class="rounded-lg bg-gray-100 px-3 py-2 text-gray-700 transition hover:bg-gray-200"
							>
								{m.actions_edit()}
							</button>
							<button
								onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteWork(work); }}
								disabled={deletingId === work.id}
								class="rounded-lg bg-red-100 px-3 py-2 text-red-700 transition hover:bg-red-200 disabled:opacity-50"
							>
								{deletingId === work.id ? '...' : m.actions_delete()}
							</button>
						</div>
					{/if}
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<p class="mt-6 text-sm text-gray-500">
		{m.work_count({ filtered: filteredWorks.length, total: works.length })}
	</p>
</div>
