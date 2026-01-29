<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Make a reactive copy of member for local updates
	let member = $state(untrack(() => data.member));
	let isEditing = $state(false);
	let editedName = $state('');
	let isSaving = $state(false);
	let error = $state('');
	let successMessage = $state('');

	// Watch for data changes and update local state
	$effect(() => {
		member = data.member;
	});

	function startEditing() {
		editedName = member.name;
		isEditing = true;
		error = '';
	}

	function cancelEditing() {
		isEditing = false;
		editedName = '';
		error = '';
	}

	async function saveName() {
		if (!editedName.trim()) {
			error = 'Name cannot be empty';
			return;
		}

		isSaving = true;
		error = '';

		try {
			const response = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editedName.trim() })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update name');
			}

			const updatedMember = (await response.json()) as typeof member;
			member = updatedMember;
			isEditing = false;
			successMessage = 'Name updated successfully';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update name';
		} finally {
			isSaving = false;
		}
	}

	// Helper to display contact email if different from OAuth email
	let displayContactEmail = $derived(
		member.email_contact && member.email_contact !== member.email_id
	);
</script>

<svelte:head>
	<title>My Profile | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">My Profile</h1>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
			{successMessage}
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<!-- Name Section (Editable) -->
		<div class="mb-6">
			<span id="name-label" class="mb-2 block text-sm font-medium text-gray-700">Name</span>
			{#if isEditing}
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={editedName}
						class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						placeholder="Enter your name"
						disabled={isSaving}
						aria-labelledby="name-label"
					/>
					<button
						onclick={saveName}
						disabled={isSaving}
						class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Save name"
					>
						{isSaving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={cancelEditing}
						disabled={isSaving}
						class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Cancel editing"
					>
						Cancel
					</button>
				</div>
			{:else}
				<div class="flex items-center justify-between">
					<span class="text-lg font-medium">{member.name}</span>
					<button
						onclick={startEditing}
						class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 transition hover:bg-blue-50"
						aria-label="Edit name"
					>
						Edit
					</button>
				</div>
			{/if}
		</div>

		<!-- OAuth Email (Read-only) -->
		<div class="mb-6">
			<span class="mb-2 block text-sm font-medium text-gray-700">Email</span>
			<span class="text-gray-900">{member.email_id}</span>
			<p class="mt-1 text-sm text-gray-500">Your OAuth login email</p>
		</div>

		<!-- Contact Email (Read-only, conditional) -->
		{#if displayContactEmail}
			<div class="mb-6">
				<span class="mb-2 block text-sm font-medium text-gray-700">Contact Email</span>
				<span class="text-gray-900">{member.email_contact}</span>
				<p class="mt-1 text-sm text-gray-500">Your preferred contact email</p>
			</div>
		{/if}

		<!-- Roles (Read-only) -->
		<div class="mb-6">
			<span class="mb-2 block text-sm font-medium text-gray-700">Roles</span>
			{#if member.roles.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.roles as role}
						<span
							class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
						>
							{role}
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No roles assigned</span>
			{/if}
		</div>

		<!-- Voices (Read-only) -->
		<div class="mb-6">
			<span class="mb-2 block text-sm font-medium text-gray-700">Voices</span>
			{#if member.voices.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.voices as voice, index}
						<span
							class="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800"
							title="{voice.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{voice.name} ({voice.abbreviation})
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No voices assigned</span>
			{/if}
		</div>

		<!-- Sections (Read-only) -->
		<div class="mb-6">
			<span class="mb-2 block text-sm font-medium text-gray-700">Sections</span>
			{#if member.sections.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.sections as section, index}
						<span
							class="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800"
							title="{section.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{section.name} ({section.abbreviation})
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No sections assigned</span>
			{/if}
		</div>

		<!-- Join Date (Read-only) -->
		<div>
			<span class="mb-2 block text-sm font-medium text-gray-700">Member Since</span>
			<span class="text-gray-900">{new Date(member.joined_at).toLocaleDateString()}</span>
		</div>
	</div>
</div>
